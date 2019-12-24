interface Spec<Flag extends string = string> {
  flags?: Record<Flag, FlagSpec>;
}

type FlagSpec<T = unknown> = FlagSpecGeneric<T> | FlagSpecBoolean;

interface FlagSpecBase<T> {
  short?: string;
  switch?: boolean;
  default?: T;
  parse?: (input: string) => T;
}

interface FlagSpecGeneric<T> extends FlagSpecBase<T> {
  switch?: false;
  parse?: (input: string) => T;
}

interface FlagSpecBoolean extends FlagSpecBase<boolean> {
  switch: true;
}

type Parser<S extends Spec> = (argv: string[]) => Program<S>;

interface Program<S extends Spec> {
  flags: ProgramFlags<S>;
  args: string[];
}

type ProgramFlags<S extends Spec> = {
  [flag in keyof S['flags']]: FlagType<S['flags'][flag]>;
};

type FlagType<F extends FlagSpec> =
  F extends FlagSpecBoolean ? FlagValue<F>
  : undefined extends F['default'] ? FlagValue<F> | undefined
  : FlagValue<F>;

type FlagValue<F extends FlagSpec> =
  F extends FlagSpecGeneric<string> ? string
  : F extends FlagSpecBoolean ? boolean
  : F extends FlagSpecGeneric<infer T> ? T
  : never;

export function tycl<S extends Spec>(spec: S): Parser<S> {
  const flagSpecs = specFlags(spec);

  return function (argv: string[]): Program<S> {
    const args: string[] = [];
    const flags: Partial<Record<keyof S['flags'], unknown>> = {};

    for (const arg of parseArgv(spec, argv)) {
      if ('flag' in arg) {
        const { flag, value } = arg;
        const flagSpec = flagSpecs![flag]; // Existence of flag guarantees flagSpecs is non-nullish
        flags[flag] = flagValue(flagSpec, value);
      } else {
        args.push(arg.value);
      }
    }

    for (const flag in flagSpecs) {
      if (flags[flag] === undefined) {
        flags[flag] = flagValue(flagSpecs[flag], undefined, false);
      }
    }

    return { flags, args } as Program<S>;
  }
}

type Arg<S extends Spec> = FlagArg<S> | PositionalArg;

interface FlagArg<S extends Spec> {
  flag: keyof S['flags'];
  value?: string;
}

interface PositionalArg {
  value: string;
}

function* parseArgv<S extends Spec>(spec: S, argv: string[]): Iterable<Arg<S>> {
  const flagLookup = buildFlagLookupTable(spec);

  const iter = argv[Symbol.iterator]();
  iter.next(); // skip node executable
  iter.next(); // skip script

  let parseFlags = true;

  for (const arg of iter) {
    if (arg === '--') {
      parseFlags = false;
      continue;
    }

    if (parseFlags && arg.startsWith('--')) {
      const [, name, eqValue] = arg.match(/^(.*?)(?:=(.*))?$/)!;
      const flag = flagLookup[name];
      if (flag === undefined) {
        throw new Error(`Unknown flag ${name}`);
      }
      const flagSpec = specFlags(spec)![flag]; // Existence of flag guarantees specFlags(spec) is non-nullish
      if (flagSpec.switch) {
        if (eqValue !== undefined) {
          throw new Error(`Flag ${name} is not expecting an argument`);
        } else {
          yield { flag };
        }
      } else if (eqValue !== undefined) {
        yield { flag, value: eqValue };
      } else {
        const [value] = iter;
        yield { flag, value };
      }
    } else if (parseFlags && arg.startsWith('-')) {
      const flag = flagLookup[arg];
      if (flag === undefined) {
        throw new Error(`Unknown short option ${arg}`);
      }
      const flagSpec = specFlags(spec)![flag]; // Existence of flag guarantees specFlags(spec) is non-nullish
      if (flagSpec.switch) {
        yield { flag };
      } else {
        const [value] = iter;
        yield { flag, value };
      }
    } else {
      yield { value: arg };
    }
  }
}

function buildFlagLookupTable<S extends Spec>(spec: S): Partial<Record<string, keyof S['flags']>> {
  const flagLookup: Record<string, keyof S['flags']> = {};

  const flags = specFlags(spec);

  for (const flagKey in flags) {
    flagLookup[`--${flagKey}`] = flagKey;
    const { short } = flags[flagKey];
    if (short !== undefined) {
      if (short.length !== 1) {
        throw new Error(`Short option ${short} is more than one character long`);
      }
      flagLookup[`-${short}`] = flagKey;
    }
  }

  return flagLookup;
}

function flagValue<F extends FlagSpec>(flagSpec: F, value?: string, present?: boolean): FlagType<F>;
function flagValue(flagSpec: FlagSpec<any>, value?: string, present = true): any {
  if (flagSpec.switch) {
    return present ? true : (flagSpec.default ?? false);
  } else if (value !== undefined) {
    return flagSpec.parse?.(value) ?? value;
  } else {
    return flagSpec.default;
  }
}

// We define this getter to help the type system get the correct type for
// spec.flags. If we don't do this, it types the value spec.flags as if spec
// was Spec<string>.
function specFlags<S extends Spec>(spec: S): S['flags'] {
  return spec.flags;
}

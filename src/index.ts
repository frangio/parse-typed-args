type Arugu<S extends Spec> = (spec: S) => Parser<S>;

interface Spec<Flag extends string = string> {
  flags?: Record<Flag, FlagSpec>;
}

type FlagSpec<T = unknown> = FlagSpecGeneric<T> | FlagSpecBoolean;

interface FlagSpecBase<T> {
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

export function arugu<S extends Spec>(spec: S): Parser<S>;
export function arugu<F extends string, S extends Spec<F>>(spec: S): Parser<S> {
  return function (argv: string[]): Program<S> {
    const args: string[] = [];
    const flags: Partial<ProgramFlags<S>> = {};

    for (const arg of parseArgv(spec, argv)) {
      if ('flag' in arg) {
        const { flag, value } = arg;
        const flagSpec = spec.flags![flag]; // parseArgv guarantees there is a matching flag
        flags[flag] = flagValue(flagSpec, value) as any;
      } else {
        args.push(arg.value);
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

function* parseArgv<F extends string, S extends Spec<F>>(spec: S, argv: string[]): Generator<Arg<S>, void> {
  const flagKeys: Record<string, keyof S['flags']> = {};

  if (spec.flags !== undefined) {
    for (const flagKey in spec.flags) {
      flagKeys[`--${flagKey}`] = flagKey as unknown as keyof S['flags'];
    }
  }

  const iter = argv[Symbol.iterator]();
  iter.next(); // skip node executable
  iter.next(); // skip script

  for (const arg of iter) {
    if (arg.startsWith('--')) {
      const [, name, eqValue] = arg.match(/^(.*?)(?:=(.*))?$/)!;
      const flag = flagKeys[name];
      if (flag === undefined) {
        throw new Error(`Unknown flag ${name}`);
      }
      const flagSpec = spec.flags![flag]; // the existence of flag guarantees spec.flags is non nullish
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
    } else {
      yield { value: arg };
    }
  }
}

function flagValue<F extends FlagSpec>(flagSpec: F, value?: string): FlagType<F>;
function flagValue(flagSpec: FlagSpec<any>, value?: string): any {
  if (flagSpec.switch) {
    return flagSpec.default ?? true;
  } else if (value !== undefined) {
    return flagSpec.parse?.(value) ?? value;
  } else {
    return flagSpec.default;
  }
}

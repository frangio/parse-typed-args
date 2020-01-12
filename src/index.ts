interface Spec<Flag extends string = string> {
  flags?: Record<Flag, FlagSpec>;
}

type FlagSpec<T = unknown> = SwitchSpec<T> | NonSwitchSpec<T>;

interface SwitchSpec<T> {
  switch: true;
  default?: T;
  short?: string;
}

interface NonSwitchSpec<T> {
  switch?: false;
  default?: T;
  parse?: (input: string) => T;
  short?: string;
}

type FlagDefault<O extends FlagSpec> =
  'default' extends keyof O
    ? O['default']
    : IfSwitch<O, false, undefined>

type FlagOutput<O extends FlagSpec> =
  'parse' extends keyof O
    ? O extends FlagSpec<infer T>
      ? T
      : unknown
    : IfSwitch<O, true, string>;

type IfSwitch<O extends FlagSpec, Then, Else> =
  'switch' extends keyof O
    ? true extends O['switch']
      ? O['switch'] extends true
        ? Then
        : unknown // e.g. O['switch'] = boolean
      : Else
    : Else

type FlagType<F extends FlagSpec> =
  // trick to force the compiler to show the expanded type to the user
  void extends void
    ? FlagDefault<F> | FlagOutput<F>
    : never;

type Parser<S extends Spec> = (argv: string[]) => Command<S>;

interface Command<S extends Spec> {
  flags: CommandFlags<S>;
  args: string[];
}

type CommandFlags<S extends Spec> = {
  [flag in keyof S['flags']]: FlagType<S['flags'][flag]>;
};

export default function parse<S extends Spec>(spec: S): Parser<S> {
  const flagSpecs = specFlags(spec);

  return function (argv: string[]): Command<S> {
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

    return { flags, args } as Command<S>;
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

interface PartialFlagArg<S extends Spec> extends FlagArg<S> {
  needsValue: boolean;
}

function* parseArgv<S extends Spec>(spec: S, argv: string[]): Iterable<Arg<S>> {
  const parseFlagArg = flagArgParser(spec);

  const argIter = argv[Symbol.iterator]();
  argIter.next(); // skip node executable
  argIter.next(); // skip script

  let parseFlags = true;

  for (const arg of argIter) {
    if (arg === '--') {
      parseFlags = false;
      continue;
    }

    if (parseFlags && arg.startsWith('-')) {
      const partialFlag = parseFlagArg(arg);
      const { flag, needsValue } = partialFlag;
      let { value } = partialFlag;
      if (needsValue) {
        [value] = argIter; // Get next arg if any
      }
      yield { flag, value };
    } else {
      yield { value: arg };
    }
  }
}

function flagArgParser<S extends Spec>(spec: S): (arg: string) => PartialFlagArg<S> {
  const flagLookup = buildFlagLookupTable(spec);

  return function parseFlagArg<S extends Spec>(arg: string): PartialFlagArg<S> {
    if (!arg.startsWith('-')) {
      throw new Error('Unexpected error');
    }

    let flagKey = arg;
    let value;

    // Extract value if there is an equal sign.
    if (arg.startsWith('--')) {
      [, flagKey, value] = arg.match(/^(.*?)(?:=(.*))?$/)!; // RegExp always trivially matches
    }

    const flag = flagLookup[flagKey];

    if (flag === undefined) {
      throw new Error(`Unknown flag ${flagKey}`);
    }

    const flagSpec = specFlags(spec)![flag]; // Existence of flag guarantees specFlags(spec) is non-nullish
    const isSwitch = flagSpec.switch === true;

    if (isSwitch && value !== undefined) {
      throw new Error(`Flag ${flagKey} is not expecting an argument`);
    }

    return { flag, value, needsValue: !isSwitch && value === undefined };
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

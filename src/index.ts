interface Spec<Option extends string = string> {
  opts?: Record<Option, OptionSpec>;
}

type OptionSpec<T = unknown> = SwitchSpec<T> | NonSwitchSpec<T>;

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

type OptionDefault<O extends OptionSpec> =
  'default' extends keyof O
    ? O['default']
    : IfSwitch<O, false, undefined>

type OptionOutput<O extends OptionSpec> =
  'parse' extends keyof O
    ? O extends OptionSpec<infer T>
      ? T
      : unknown
    : IfSwitch<O, true, string>;

type IfSwitch<O extends OptionSpec, Then, Else> =
  'switch' extends keyof O
    ? true extends O['switch']
      ? O['switch'] extends true
        ? Then
        : unknown // e.g. O['switch'] = boolean
      : Else
    : Else

type OptionType<F extends OptionSpec> =
  // Trick to force the compiler to show the expanded type to the user
  void extends void
    ? OptionDefault<F> | OptionOutput<F>
    : never;

type Parser<S extends Spec> = (argv: string[]) => Command<S>;

interface Command<S extends Spec> {
  opts: CommandOptions<S>;
  args: string[];
}

type CommandOptions<S extends Spec> = {
  [opt in keyof S['opts']]: OptionType<S['opts'][opt]>;
};

export default function parse<S extends Spec>(spec: S): Parser<S> {
  const optSpecs = specOpts(spec);

  return function (argv: string[]): Command<S> {
    const args: string[] = [];
    const opts: Partial<Record<keyof S['opts'], unknown>> = {};

    for (const arg of parseArgv(spec, argv)) {
      if ('option' in arg) {
        const { option, value } = arg;
        const optSpec = optSpecs![option]; // Existence of opt guarantees optSpecs is non-nullish
        opts[option] = optValue(optSpec, value);
      } else {
        args.push(arg.value);
      }
    }

    for (const opt in optSpecs) {
      if (opts[opt] === undefined) {
        opts[opt] = optValue(optSpecs[opt], undefined, false);
      }
    }

    return { opts, args } as Command<S>;
  }
}

type Arg<S extends Spec> = OptionArg<S> | PositionalArg;

interface OptionArg<S extends Spec> {
  option: keyof S['opts'];
  value?: string;
}

interface PositionalArg {
  value: string;
}

interface PartialOptionArg<S extends Spec> extends OptionArg<S> {
  needsValue: boolean;
}

function* parseArgv<S extends Spec>(spec: S, argv: string[]): Iterable<Arg<S>> {
  const parseOptArg = optArgParser(spec);

  const argIter = argv[Symbol.iterator]();
  argIter.next(); // skip node executable
  argIter.next(); // skip script

  let parseOpts = true;

  for (const arg of argIter) {
    if (arg === '--') {
      parseOpts = false;
      continue;
    }

    if (parseOpts && arg.startsWith('-')) {
      const partialOpt = parseOptArg(arg);
      const { option, needsValue } = partialOpt;
      let { value } = partialOpt;
      if (needsValue) {
        [value] = argIter; // Get next arg if any
      }
      yield { option, value };
    } else {
      yield { value: arg };
    }
  }
}

function optArgParser<S extends Spec>(spec: S): (arg: string) => PartialOptionArg<S> {
  const optLookup = buildOptLookupTable(spec);

  return function parseOptArg<S extends Spec>(arg: string): PartialOptionArg<S> {
    if (!arg.startsWith('-')) {
      throw new Error('Unexpected error');
    }

    let optKey = arg;
    let value;

    // Extract value if there is an equal sign.
    if (arg.startsWith('--')) {
      [, optKey, value] = arg.match(/^(.*?)(?:=(.*))?$/)!; // RegExp always trivially matches
    }

    const option = optLookup[optKey];

    if (option === undefined) {
      throw new Error(`Unknown opt ${optKey}`);
    }

    const optSpec = specOpts(spec)![option]; // Existence of option guarantees specOpts(spec) is non-nullish
    const isSwitch = optSpec.switch === true;

    if (isSwitch && value !== undefined) {
      throw new Error(`Option ${optKey} is not expecting an argument`);
    }

    return { option, value, needsValue: !isSwitch && value === undefined };
  }
}

function buildOptLookupTable<S extends Spec>(spec: S): Partial<Record<string, keyof S['opts']>> {
  const optLookup: Record<string, keyof S['opts']> = {};

  const opts = specOpts(spec);

  for (const optKey in opts) {
    optLookup[`--${optKey}`] = optKey;
    const { short } = opts[optKey];
    if (short !== undefined) {
      if (short.length !== 1) {
        throw new Error(`Short option ${short} is more than one character long`);
      }
      optLookup[`-${short}`] = optKey;
    }
  }

  return optLookup;
}

function optValue<F extends OptionSpec>(optSpec: F, value?: string, present?: boolean): OptionType<F>;
function optValue(optSpec: OptionSpec<any>, value?: string, present = true): any {
  if (optSpec.switch) {
    return present ? true : (optSpec.default ?? false);
  } else if (value !== undefined) {
    return optSpec.parse?.(value) ?? value;
  } else {
    return optSpec.default;
  }
}

// We define this getter to help the type system get the correct type for
// spec.opts. If we don't do this, it types the value spec.opts as if spec
// was Spec<string>.
function specOpts<S extends Spec>(spec: S): S['opts'] {
  return spec.opts;
}

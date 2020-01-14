interface Spec<Option extends string = string> {
  opts?: Record<Option, OptionSpec>;
}

type OptionSpec<T = unknown> = NonSwitchRequiredSpec<T> | SwitchSpec<T> | NonSwitchOptionalSpec<T>;

interface OptionBaseSpec<T> {
  switch?: boolean;
  parse?: (input: string) => T;
  default?: T;
  required?: boolean;
  short?: string;
}

interface SwitchSpec<T> extends OptionBaseSpec<T> {
  switch: true;
  parse?: never;
  required?: never;
}

interface NonSwitchOptionalSpec<T> extends OptionBaseSpec<T> {
  switch?: false;
  required?: false;
}

interface NonSwitchRequiredSpec<T> extends OptionBaseSpec<T> {
  switch?: false;
  default?: never;
  required: true;
}

type OptionDefault<O extends OptionSpec> =
  Get<O, 'default', undefined> extends infer P
    ? P extends undefined
      ? IfOptionIsSwitch<O, false, IfOptionIsRequired<O, never, undefined>>
      : P
    : never;

type OptionOutput<O extends OptionSpec> =
  Get<O, 'parse', undefined> extends infer P
    ? P extends (input: string) => infer T
      ? T
      : P extends undefined
        ? IfOptionIsSwitch<O, true, string>
        : never
    : never;

type IfOptionIsSwitch<O extends OptionSpec, Then, Else> =
  If<Get<O, 'switch'>, Then, Else>;

type IfOptionIsRequired<O extends OptionSpec, Then, Else> =
  If<Get<O, 'required'>, Then, Else>;

type Get<T, K extends string, D = never> =
  T extends infer T1
    ? K extends keyof T1
      ? T1 extends { [key in K]: infer U }
        ? U
        : T1 extends { [key in K]?: infer U }
          ? U | undefined
          : never
      : D
    : never;

type If<Cond, Then, Else> =
  true extends Cond
    ? Cond extends true
      ? Then
      : Else
    : Else;

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
        opts[option] = optValue(option as string, optSpec, value);
      } else {
        args.push(arg.value);
      }
    }

    for (const opt in optSpecs) {
      if (opts[opt] === undefined) {
        opts[opt] = optValue(opt, optSpecs[opt], undefined, false);
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

function optValue<F extends OptionSpec>(name: string, optSpec: F, value?: string, present?: boolean): OptionType<F>;
function optValue(name: string, optSpec: OptionSpec<object>, value?: string, present = true): OptionType<OptionSpec<object>> {
  if (optSpec.switch) {
    if (present) {
      return true;
    } else if ('default' in optSpec) {
      optSpec.default;
    } else {
      return false;
    }
  } else if (value !== undefined) {
    return optSpec.parse?.(value) ?? value;
  } else if ('default' in optSpec) {
    return optSpec.default;
  } else if (optSpec.required) {
    throw new MissingRequiredOption(name);
  }
}

function switchValue(name: string, optSpec: SwitchSpec<object>, value?: string, present = true): OptionType<SwitchSpec<object>> {
  if (present) {
    return true;
  } else if ('default' in optSpec) {
    return optSpec.default;
  } else {
    return false;
  }
}

// We define this getter to help the type system get the correct type for
// spec.opts. If we don't do this, it types the value spec.opts as if spec
// was Spec<string>.
function specOpts<S extends Spec>(spec: S): S['opts'] {
  return spec.opts;
}

export class MissingRequiredOption extends Error {
  constructor(readonly option: string) {
    super(`Missing required option '${option}'`);
  }
}

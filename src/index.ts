interface Spec<Option extends string = string> {
  opts?: Record<Option, OptionSpec>;
}

type OptionSpec<T = unknown> = SwitchSpec<T> | NonSwitchSpec<T>;

interface OptionBaseSpec<T> {
  switch?: boolean;
  parse?: (input: string) => T;
  default?: T;
  short?: string;
}

interface SwitchSpec<T> extends OptionBaseSpec<T> {
  switch: true;
  parse?: never;
}

interface NonSwitchSpec<T> extends OptionBaseSpec<T> {
  switch?: false;
}

type OptionDefault<O extends OptionSpec> =
  Get<O, 'default', undefined> extends infer P
    ? P extends undefined
      ? IfOptionIsSwitch<O, false, undefined>
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
        opts[arg.option.name] = optValue(arg.option.spec, arg.value);
      } else {
        args.push(arg.value);
      }
    }

    for (const opt in optSpecs) {
      if (!(opt in opts)) {
        opts[opt] = optValue(optSpecs[opt], undefined, false);
      }
    }

    return { opts, args } as Command<S>;
  }
}

type Arg<S extends Spec> = OptionArg<S> | PositionalArg;

interface OptionArg<S extends Spec> {
  option: OptionLookupResult<S>;
  value?: string;
}

interface PositionalArg {
  value: string;
}

function* parseArgv<S extends Spec>(spec: S, argv: string[]): Generator<Arg<S>> {
  const normalizedArgs = normalizeArgv(spec, argv);

  for (const arg of normalizedArgs) {
    if (arg.value === undefined && 'option' in arg && !arg.option.spec.switch) {
      const next = normalizedArgs.next();
      if (next.done || 'option' in next.value) {
        throw new Error(`Missing argument for option '${arg.option.name}'`);
      } else {
        arg.value = next.value.value;
      }
    }

    yield arg;
  }
}

function* normalizeArgv<S extends Spec>(spec: S, argv: string[]): Generator<Arg<S>> {
  const parseArg = argParser(spec);

  const argvIter = argv[Symbol.iterator]();
  argvIter.next(); // skip node executable
  argvIter.next(); // skip script

  let parseOpts = true;

  for (const arg of argvIter) {
    if (arg === '--') {
      parseOpts = false;
      continue;
    }

    if (parseOpts) {
      yield* parseArg(arg);
    } else {
      yield { value: arg };
    }
  }
}

function argParser<S extends Spec>(spec: S): (arg: string) => Generator<Arg<S>> {
  const optLookup = buildOptLookup<S>(spec);

  return function* parseArg(arg: string): Generator<Arg<S>> {
    const match = arg.match(/^-(.+?)(?:=(.*))?$/);

    if (match) {
      const [, key, value] = match;

      if (key.startsWith('-')) {
        const option = optLookup(key);

        if (value !== undefined && option.spec.switch) {
          throw new Error(`Unexpected argument for option '${name}'`);
        }

        yield { option, value };
      } else {
        const chars = [...key];
        const options = chars.map(c => optLookup(c));
        const lastOption = options.pop()!; // The regex guarantees there is at least one option

        for (const option of options) {
          if (!option.spec.switch) {
            throw new Error(`Missing argument for option '${option.name}'`);
          }
          yield { option };
        }

        yield { option: lastOption };
      }
    } else {
      yield { value: arg };
    }
  }
}

interface OptionLookupResult<S extends Spec> {
  name: keyof S['opts'];
  spec: OptionSpec;
}

function buildOptLookup<S extends Spec>(spec: S): (key: string) => OptionLookupResult<S> {
  const optLookup: Partial<Record<string, OptionLookupResult<S>>> = {};

  const opts = specOpts(spec);

  for (const name in opts) {
    const spec = opts[name];
    optLookup['-' + name] = { name, spec };
    const { short } = spec;
    if (short !== undefined) {
      if (short.length !== 1) {
        throw new Error(`Short option ${short} is more than one character long`);
      }
      optLookup[short] = { name, spec };
    }
  }

  return key => {
    const res = optLookup[key];
    if (res === undefined) {
      throw new Error(`Unknown option: -${key}`);
    } else {
      return res;
    }
  }
}

function optValue<F extends OptionSpec>(optSpec: F, value?: string, present?: boolean): OptionType<F>;
function optValue(optSpec: OptionSpec<object>, value?: string, present = true): OptionType<OptionSpec<object>> {
  if (optSpec.switch) {
    if (present) {
      return true;
    } else if ('default' in optSpec) {
      optSpec.default;
    } else {
      return false;
    }
  } else if (value !== undefined) {
    if (optSpec.parse !== undefined) {
      return optSpec.parse(value);
    } else {
      return value;
    }
  } else if ('default' in optSpec) {
    return optSpec.default;
  }
}

// We define this getter to help the type system get the correct type for
// spec.opts. If we don't do this, it types the value spec.opts as if spec
// was Spec<string>.
function specOpts<S extends Spec>(spec: S): S['opts'] {
  return spec.opts;
}

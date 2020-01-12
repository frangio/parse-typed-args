# parse-typed-args

**Fully typed CLI entry points.** Command line argument parser for TypeScript.

## Install

```
npm install parse-typed-args
```

## Usage

```typescript
import parse from 'parse-typed-args';

const command = parse({
  opts: {
    flavor: {},
    amount: {
      default: 1,
      parse: Number,
    },
    cone: {
      switch: true,
    },
  },
})(process.argv);

const { flavor, amount } = command.opts;

// Types are inferred from the command specification above.
// - flavor : string | undefined
// - amount : number
// - cone : boolean

if (flavor === undefined) {
  console.error('ice-cream-please --flavor <flavor> [--amount <amount>] [--cone]');
  process.exit(1);
}

let msg = `Preparing ${amount} ${flavor}`;

if (amount > 1) {
  msg += ' ice creams';
} else {
  msg += ' ice cream';
}

if (cone) {
  msg += ' on a cone';
}

console.log(msg);

```

```
$ ice-cream-please --flavor chocolate --amount 2
Preparing 2 chocolate ice creams
```

## Reference

_**Note:** The types presented here are simplified. In reality, almost all types are
generic on the specific `S extends Spec` that contains the details of the
accepted options, or `O extends string` that contains the names of the options._

### `parse(spec: Spec): Parser`

This function constructs a parser function from the command specification.

### `Parser = (argv: string[]) => Command`

The parser receives a full Node.js `argv` array, which in general will be
`process.argv`. Keep in mind that this array is expected to contain the `node`
executable path in the first position, and the script path in second position,
so the actual arguments will be parsed from index 2 onwards.

### `Command`

```typescript
interface Command {
  args: string[];
  opts: CommandOptions;
}
```

`command.args` contains all of the positional arguments found in `argv`.

`command.opts` is an object whose properties map to the options in the
specification. For every `optName` in `spec.opts` there will be a property
`command.opts[optName]`, whose type `T` will depend on the details of the option.
The rules for figuring out this type are complex but should be intuitive.
You should rely on your IDE and compiler. Here's some rules of thumb:

* By default, `T` will be `string | undefined`.
* If you add a parse function `(arg: string) => U`, `T` will be `U | undefined`.
* If you add a default value, `T` will be `U`.
* If the option is a switch, `T` will be `boolean`.

### `Spec`

```typescript
interface Spec {
  opts?: {
    [opt: string]: OptionSpec;
  };
}

interface OptionSpec<T> {
  short?: string;
  switch?: boolean;
  default?: T;
  parse?: (input: string) => T;
}
```

#### `OptionSpec.short`

The character used for abbreviated options, e.g, `-a`. If not a single character
string, the parser will throw an error.

#### `OptionSpec.switch`

Whether this option is a boolean switch. Defaults to `false`. If `true`, the option
will not accept a value. If a value is passed on the command line using
`--option=value` syntax, the parser will throw an error.

#### `OptionSpec.default`

The default value that will be returned in the `command` if the option is not
specified on the command line.

#### `OptionSpec.parse`

A function that will be used to convert the option value to another type.

## Acknowledgment

This project was inspired by the [oclif] framework.

[oclif]: https://oclif.io

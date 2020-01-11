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
  flags: {
    flavor: {},
    amount: {
      default: 1,
      parse: Number,
    },
  },
})(process.argv);

const { flavor, amount } = command.flags;

// Types are inferred from the command specification above.
// - flavor : string | undefined
// - amount : number

if (flavor === undefined) {
  console.error('icem-cream-please --flavor <flavor> [--amount <amount>]');
  process.exit(1);
}

console.log(`Preparing ${amount} ${flavor} ice cream${amount > 1 ? 's' : ''}`);

```

```
$ ice-cream-please --flavor chocolate --amount 2
Preparing 2 chocolate ice creams
```

## Reference

_**Note:** The types presented here are simplified. In reality, almost all types are
generic on the specific `S extends Spec` that contains the details of the
accepted flags, or `F extends string` that contains the names of the flags._

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
  flags: CommandFlags;
}
```

`command.args` contains all of the positional arguments found in `argv`.

`command.flags` is an object whose properties map to the flags in the
specification. For every `flagName` in `spec.flags` there will be a property
`command.flags[flagName]`, whose type `T` will depend on the details of the flag.
The rules for figuring out this type are complex but should be intuitive.
You should rely on your IDE and compiler. Here's some rules of thumb:

* By default, `T` will be `string | undefined`.
* If you add a parse function `(arg: string) => U`, `T` will be `U | undefined`.
* If you add a default value, `T` will be `U`.
* If the flag is a switch, `T` will be `boolean`.

### `Spec`

```typescript
interface Spec {
  flags?: {
    [flag: string]: FlagSpec;
  };
}

interface FlagSpec<T> {
  short?: string;
  switch?: boolean;
  default?: T;
  parse?: (input: string) => T;
}
```

#### `FlagSpec.short`

The character used for abbreviated flags, e.g, `-a`. If not a single character
string, the parser will throw an error.

#### `FlagSpec.switch`

Whether this flag is a boolean switch. Defaults to `false`. If `true`, the flag
will not accept a value. If a value is passed on the command line using
`--flag=value` syntax, the parser will throw an error.

#### `FlagSpec.default`

The default value that will be returned in the `command` if the flag is not
specified on the command line.

#### `FlagSpec.parse`

A function that will be used to convert the flag value to another type.

## Acknowledgment

This project was inspired by the [oclif] framework.

[oclif]: https://oclif.io

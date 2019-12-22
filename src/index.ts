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

export function arugu<S extends Spec>(spec: S): Parser<S> {
  return function (argv: string[]): Program<S> {
    const flags: Partial<ProgramFlags<S>> = {};

    const iter = argv[Symbol.iterator]();
    iter.next();
    iter.next();

    if (spec.flags !== undefined) {
      for (const arg of iter) {
        let { flag, input } = parseFlag(arg);

        if (flag === undefined) {
          continue;
        }

        const flagPair = Object.entries(spec.flags).find(([f, s]) => `--${f}` === flag);

        if (flagPair === undefined) {
          throw new Error(`Unknown flag ${flag}`);
        }

        const [flagName, flagSpec] = flagPair;

        if (!flagSpec.switch && input === undefined) {
          const res = iter.next();
          if (res.done) {
            if ('default' in flagSpec) {
              input = flagSpec.default as any;
            } else {
              throw new Error(`Missing value for flag ${flag}`);
            }
          } else {
            input = res.value;
          }
        }

        flags[flagName as keyof ProgramFlags<S>] = flagSpec.parse?.(input!) ?? input as any;
      }
    }

    return { flags: flags as ProgramFlags<S> };
  }
}

function parseFlag(arg: string): { flag?: string, input?: string } {
  if (arg.startsWith('--')) {
    const [, flag, input] = arg.match(/^(.*?)(?:=(.*))?$/)!;
    return { flag, input };
  } else {
    return {};
  }
}

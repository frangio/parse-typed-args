import test from 'ava';

import parse from '.';

test('empty spec', t => {
  const input = ['node', 'script.js', 'a', 'b'];
  const output = parse({})(input);
  t.deepEqual(output, {
    opts: {},
    args: ['a', 'b'],
  });
});

function argv(...args: string[]): string[] {
  return ['node', 'script.js', ...args];
}

test('flag with equal sign', t => {
  const input = argv('--option=11');
  const output = parse({
    opts: {
      option: {},
    },
  })(input);
  t.is(output.opts.option, '11');
});

test('flag with separate value', t => {
  const input = argv('--option', '33');
  const output = parse({
    opts: {
      option: {},
    },
  })(input);
  t.is(output.opts.option, '33');
});

test('flag with parse', t => {
  const input = argv('--option', '44');
  const output = parse({
    opts: {
      option: {
        parse: s => parseInt(s, 10),
      },
    },
  })(input);
  t.is(output.opts.option, 44);
});

test('flag with parse and default', t => {
  const input = argv('--option', '44');
  const output = parse({
    opts: {
      option: {
        parse: s => parseInt(s, 10),
        default: 5,
      },
    },
  })(input);
  t.is(output.opts.option, 44);
});

test('mixed opts and args', t => {
  const input = argv('a', '--opt1', '44', 'b', '--opt2=55', 'c');
  const output = parse({
    opts: {
      opt1: {
        parse: s => parseInt(s, 10),
        default: 5,
      },
      opt2: {},
    },
  })(input);
  t.is(output.opts.opt1, 44);
  t.is(output.opts.opt2, '55');
  t.deepEqual(output.args, ['a', 'b', 'c']);
});

test('default value for missing flag', t => {
  const input = argv();
  const output = parse({
    opts: {
      option: {
        default: 1,
        parse: Number,
      },
    },
  })(input);
  t.is(output.opts.option, 1);
});

test('stop parsing opts after --', t => {
  const input = argv('--yes', '--', '--no');
  const output = parse({
    opts: {
      yes: {
        switch: true,
      },
    },
  })(input);
  t.is(output.opts.yes, true);
  t.deepEqual(output.args, ['--no']);
});

test('short switch', t => {
  const input = argv('-y');
  const output = parse({
    opts: {
      yes: {
        switch: true,
        short: 'y',
      },
    },
  })(input);
  t.is(output.opts.yes, true);
});

test('short option with value', t => {
  const input = argv('-v', '10');
  const output = parse({
    opts: {
      value: {
        short: 'v',
      },
    },
  })(input);
  t.is(output.opts.value, '10');
});

test('default value for boolean switches', t => {
  const input = argv();
  const output = parse({
    opts: {
      yes: {
        switch: true,
      },
    },
  })(input);
  t.is(output.opts.yes, false);
});

test('collapsed short options', t => {
  const input = argv('-abc', '10');
  const output = parse({
    opts: {
      alpha: { short: 'a', switch: true },
      bravo: { short: 'b', switch: true },
      charlie: { short: 'c' },
    },
  })(input);
  t.is(output.opts.alpha, true);
  t.is(output.opts.bravo, true);
  t.is(output.opts.charlie, '10');
});

test('default does not override undefined', t => {
  const input = argv('--opt', '15');
  const output = parse({
    opts: {
      opt: { parse: () => undefined, default: '20' },
    },
  })(input);
  t.is(output.opts.opt, undefined);
});

import test from 'ava';

import { tycl } from '.';

test('empty spec', t => {
  const input = ['node', 'script.js', 'a', 'b'];
  const output = tycl({})(input);
  t.deepEqual(output, {
    flags: {},
    args: ['a', 'b'],
  });
});

function argv(...args: string[]): string[] {
  return ['node', 'script.js', ...args];
}

test('flag with equal sign', t => {
  const input = argv('--option=11');
  const output = tycl({
    flags: {
      option: {},
    },
  })(input);
  t.is(output.flags.option, '11');
});

test('flag with default', t => {
  const input = argv('--option');
  const output = tycl({
    flags: {
      option: {
        default: '22',
      },
    },
  })(input);
  t.is(output.flags.option, '22');
});

test('flag with separate value', t => {
  const input = argv('--option', '33');
  const output = tycl({
    flags: {
      option: {},
    },
  })(input);
  t.is(output.flags.option, '33');
});

test('flag with parse', t => {
  const input = argv('--option', '44');
  const output = tycl({
    flags: {
      option: {
        parse: s => parseInt(s, 10),
      },
    },
  })(input);
  t.is(output.flags.option, 44);
});

test('flag with parse and default', t => {
  const input = argv('--option', '44');
  const output = tycl({
    flags: {
      option: {
        parse: s => parseInt(s, 10),
        default: 5,
      },
    },
  })(input);
  t.is(output.flags.option, 44);
});

test('mixed flags and args', t => {
  const input = argv('a', '--opt1', '44', 'b', '--opt2=55', 'c');
  const output = tycl({
    flags: {
      opt1: {
        parse: s => parseInt(s, 10),
        default: 5,
      },
      opt2: {},
    },
  })(input);
  t.is(output.flags.opt1, 44);
  t.is(output.flags.opt2, '55');
  t.deepEqual(output.args, ['a', 'b', 'c']);
});

test('default value for missing flag', t => {
  const input = argv();
  const output = tycl({
    flags: {
      option: {
        default: 1,
      },
    },
  })(input);
  t.is(output.flags.option, 1);
});

test('stop parsing flags after --', t => {
  const input = argv('--yes', '--', '--no');
  const output = tycl({
    flags: {
      yes: {
        switch: true,
      },
    },
  })(input);
  t.is(output.flags.yes, true);
  t.deepEqual(output.args, ['--no']);
});

test('short switch', t => {
  const input = argv('-y');
  const output = tycl({
    flags: {
      yes: {
        switch: true,
        short: 'y',
      },
    },
  })(input);
  t.is(output.flags.yes, true);
});

test('short option with value', t => {
  const input = argv('-v', '10');
  const output = tycl({
    flags: {
      value: {
        short: 'v',
      },
    },
  })(input);
  t.is(output.flags.value, '10');
});

test('default value for boolean switches', t => {
  const input = argv();
  const output = tycl({
    flags: {
      yes: {
        switch: true,
      },
    },
  })(input);
  t.is(output.flags.yes, false);
});

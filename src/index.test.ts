import test from 'ava';

import { arugu } from '.';

test('empty spec', t => {
  const input = ['node', 'script.js', 'a', 'b'];
  const output = arugu({})(input);
  t.deepEqual(output, {
    flags: {},
    args: ['a', 'b'],
  });
});

function argv(...args: string[]): string[] {
  return ['node', 'script.js', ...args];
}

test('flag with equal sign', t => {
  const input = argv('--option=1');
  const output = arugu({
    flags: {
      option: {},
    },
  })(input);
  t.is(output.flags.option, '1');
});

test('flag with default', t => {
  const input = argv('--option');
  const output = arugu({
    flags: {
      option: {
        default: '2',
      },
    },
  })(input);
  t.is(output.flags.option, '2');
});

test('flag with separate value', t => {
  const input = argv('--option', '3');
  const output = arugu({
    flags: {
      option: {},
    },
  })(input);
  t.is(output.flags.option, '3');
});

test('flag with parse', t => {
  const input = argv('--option', '4');
  const output = arugu({
    flags: {
      option: {
        parse: s => parseInt(s, 10),
      },
    },
  })(input);
  t.is(output.flags.option, 4);
});

test('flag with parse and default', t => {
  const input = argv('--option', '4');
  const output = arugu({
    flags: {
      option: {
        parse: s => parseInt(s, 10),
        default: 5,
      },
    },
  })(input);
  t.is(output.flags.option, 4);
});

test('mixed flags and args', t => {
  const input = argv('a', '--opt1', '4', 'b', '--opt2=5', 'c');
  const output = arugu({
    flags: {
      opt1: {
        parse: s => parseInt(s, 10),
        default: 5,
      },
      opt2: {},
    },
  })(input);
  t.is(output.flags.opt1, 4);
  t.is(output.flags.opt2, '5');
  t.deepEqual(output.args, ['a', 'b', 'c']);
});

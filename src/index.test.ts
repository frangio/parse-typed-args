import test from 'ava';

import { arugu } from '.';

test('empty spec', t => {
  const input = ['node', 'script.js', 'a', 'b'];
  const output = arugu({})(input);
  t.deepEqual(output, {
    flags: {},
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
  const option: string | undefined = output.flags.option;
  t.is(option, '1');
});

test('flag with default', t => {
  const input = argv('--option');
  const output = arugu({
    flags: {
      option: {
        default: '2'
      },
    },
  })(input);
  const option: string | undefined = output.flags.option;
  t.is(option, '2');
});

test('flag with separate value', t => {
  const input = argv('--option', '3');
  const output = arugu({
    flags: {
      option: {
      },
    },
  })(input);
  const option: string | undefined = output.flags.option;
  t.is(option, '3');
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
  const option: number | undefined = output.flags.option;
  t.is(option, 4);
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
  const option: number = output.flags.option;
  t.is(option, 4);
});

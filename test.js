import path from 'path';
import fs from 'fs';
import {serial as test} from 'ava';
import * as babel from 'babel-core';
import * as types from 'babel-types';
import fn from './';

function transform(input) {
	return babel.transform(input, {
		plugins: [fn],
		filename: 'some-file.js'
	});
}

var examples = [];

function addExample(input, output) {
	examples.push(
		'input:',
		'',
		'```js',
		input,
		'```',
		'',
		'becomes:',
		'',
		'```js',
		output,
		'```',
		'',
		'---',
		''
	);
}

const HELPER = `function _avaThrowsHelper(fn, data) {
  try {
    return fn();
  } catch (e) {
    var type = typeof e;

    if (e !== null && (type === "object" || type === "function")) {
      try {
        Object.defineProperty(e, "_avaThrowsHelperData", {
          value: data
        });
      } catch (e) {}
    }

    throw e;
  }
}\n`;

function wrapped(throws, expression, line, column) {
	return `t.${throws}(_avaThrowsHelper(function () {
  return ${expression};
}, {
  line: ${line},
  column: ${column},
  source: "${expression}",
  filename: "some-file.js"
}));`;
}

test('creates a helper', t => {
	const input = 't.throws(foo())';
	const code = transform(input).code;

	const expected = [
		HELPER,
		wrapped('throws', 'foo()', 1, 9)
	].join('\n');

	t.is(code, expected);
	addExample(input, code);
});

test('creates the helper only once', t => {
	const input = 't.throws(foo());\nt.throws(bar());';
	const code = transform(input).code;

	const expected = [
		HELPER,
		wrapped('throws', 'foo()', 1, 9),
		wrapped('throws', 'bar()', 2, 9)
	].join('\n');

	t.is(code, expected);
	addExample(input, code);
});

test('does nothing if it does not match', t => {
	const input = 't.is(foo());';
	const code = transform(input).code;

	t.is(code, input);
	addExample(input, code);
});

test('helps notThrows', t => {
	const input = 't.notThrows(baz())';
	const code = transform(input).code;

	const expected = [
		HELPER,
		wrapped('notThrows', 'baz()', 1, 12)
	].join('\n');

	t.is(code, expected);
	addExample(input, code);
});

test('does not throw on generated code', () => {
	var statement = types.expressionStatement(types.callExpression(
		types.memberExpression(
			types.identifier('t'),
			types.identifier('throws')
		),
		[types.callExpression(
			types.identifier('foo'),
			[]
		)]
	));

	var program = types.program([statement]);

	babel.transformFromAst(program, null, {
		plugins: [fn],
		filename: 'some-file.js'
	});
});

if (process.env.WRITE_EXAMPLES) {
	test('writing examples', () => {
		fs.writeFileSync(
			path.join(__dirname, 'example-output.md'),
			examples.join('\n')
		);
	});
}

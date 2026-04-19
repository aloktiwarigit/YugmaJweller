const { RuleTester } = require('eslint');
const rule = require('../rules/no-untranslated-strings');

const tester = new RuleTester({ parser: require.resolve('@typescript-eslint/parser'), parserOptions: { ecmaFeatures: { jsx: true } } });

tester.run('no-untranslated-strings', rule, {
  valid: [
    { code: `<Text>{t('auth.phone.title')}</Text>` },
    { code: `<Button title={t('auth.submit')} />` },
    { code: `<Input placeholder={t('auth.phone.placeholder')} />` },
    { code: `<View><Image source={{ uri: 'x' }} /></View>` }, // non-target tags untouched
  ],
  invalid: [
    { code: `<Text>Hello</Text>`, errors: [{ messageId: 'noUntranslatedString' }] },
    { code: `<Button title="Submit" />`, errors: [{ messageId: 'noUntranslatedString' }] },
    { code: `<Input placeholder="Phone" />`, errors: [{ messageId: 'noUntranslatedString' }] },
  ],
});

console.log('no-untranslated-strings rule tests passed');

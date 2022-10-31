test.each([
  // 1 Given
  {
    given: {},
    expected: {},
  },
])(``, function ({ given, expected }) {

  // 2 When

  // 3 Then
  expect(false).toBe(true);
});



runTests(
  "test",
  [
    {
      given: {},
      then: {},
    },
    {
      given: { },
      errorMessage: "",
    },
  ],
  function (given) {
    return {};
  },
);

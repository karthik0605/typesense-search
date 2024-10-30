import mut from "./module.js"; // MUT = Module Under Test

test("Testing sum -- success", () => {
  const expected = 30;
  const got = mut.sum(12, 18);
  expect(got).toBe(expected);
});

test("Testing div -- success", () => {
  const expected = 5;
  const got = mut.div(30, 6);
  expect(got).toBe(expected);
});

test("Testing div -- success", () => {
  const expected = 6;
  const got = mut.div(30, 6);
  expect(got).not.toBe(expected);
});

test("Testing div -- failure", () => {
  expect(() => mut.div(30, 0).toThrow());
});

test("Testing containsNumbers -- success", () => {
  const test = "owiqf552";
  const expected = true;
  const got = mut.containsNumbers(test);
  expect(got).toBe(expected);
});

test("Testing containsNumbers -- success", () => {
  const test = "5";
  const expected = true;
  const got = mut.containsNumbers(test);
  expect(got).toBe(expected);
});

test("Testing containsNumbers -- success", () => {
  const test = "a%%^";
  const expected = false;
  const got = mut.containsNumbers(test);
  expect(got).toBe(expected);
});

//Fails as isNan only checks if something is not a number, so for other characters this doesn't suffice
test("Testing containsNumbers -- failure", () => {
  const test = " *&@#$%^";
  const expected = false;
  const got = mut.containsNumbers(test);
  expect(got).toBe(expected);
});

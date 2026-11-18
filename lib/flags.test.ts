import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_401_LINK_ENABLED,
  AUTH_401_LINK_RAW,
  auth401LinkConfigError,
  parseAuth401LinkFlag,
} from "./flags";

test("resolver: exactly '1' is ON", () => {
  assert.equal(parseAuth401LinkFlag("1"), true);
  assert.equal(parseAuth401LinkFlag("0"), false);
  assert.equal(parseAuth401LinkFlag(""), false);
  assert.equal(parseAuth401LinkFlag(undefined), false);
});

test("resolver: Boolean('0') trap is not hit", () => {
  assert.equal(Boolean("0"), true);
  assert.equal(parseAuth401LinkFlag("0"), false);
  assert.equal(parseAuth401LinkFlag(" true "), false);
  assert.equal(parseAuth401LinkFlag("true"), false);
});

test("module constant comes from the single env read", () => {
  assert.equal(typeof AUTH_401_LINK_ENABLED, "boolean");
  assert.equal(AUTH_401_LINK_ENABLED, parseAuth401LinkFlag(AUTH_401_LINK_RAW));
});

test("build gate rejects illegal values", () => {
  assert.equal(auth401LinkConfigError("1"), null);
  assert.equal(auth401LinkConfigError("0"), null);
  assert.equal(auth401LinkConfigError(""), null);
  assert.equal(auth401LinkConfigError(undefined), null);
  assert.ok(auth401LinkConfigError("yes"));
  assert.ok(auth401LinkConfigError("true"));
  assert.ok(auth401LinkConfigError("01"));
});

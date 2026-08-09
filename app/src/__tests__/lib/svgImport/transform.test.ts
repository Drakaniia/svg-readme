import { describe, it, expect } from "vitest";
import {
  parseTransform,
  applyMatrixToPoint,
  decomposeMatrix,
  isIdentity,
  IDENTITY_MATRIX,
} from "../../../lib/svgImport/transform";
import type { TransformMatrix } from "../../../lib/svgImport/transform";

function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-4);
}

describe("parseTransform", () => {
  it("parses translate", () => {
    const m = parseTransform("translate(10, 20)");
    const [x, y] = applyMatrixToPoint(m, [0, 0]);
    expectClose(x, 10);
    expectClose(y, 20);
  });

  it("parses translate with single argument", () => {
    const m = parseTransform("translate(5)");
    const [x, y] = applyMatrixToPoint(m, [1, 1]);
    expectClose(x, 6);
    expectClose(y, 1);
  });

  it("parses scale", () => {
    const m = parseTransform("scale(2, 3)");
    const [x, y] = applyMatrixToPoint(m, [10, 10]);
    expectClose(x, 20);
    expectClose(y, 30);
  });

  it("parses rotate about origin", () => {
    const m = parseTransform("rotate(90)");
    const [x, y] = applyMatrixToPoint(m, [10, 0]);
    expectClose(x, 0);
    expectClose(y, 10);
  });

  it("parses rotate about a center", () => {
    const m = parseTransform("rotate(90, 10, 10)");
    const [x, y] = applyMatrixToPoint(m, [20, 10]);
    expectClose(x, 10);
    expectClose(y, 20);
  });

  it("composes transforms in SVG order", () => {
    // translate(10,0) then rotate(90): rotate applies first in the local frame
    const m = parseTransform("translate(10, 0) rotate(90)");
    const [x, y] = applyMatrixToPoint(m, [0, 0]);
    expectClose(x, 10);
    expectClose(y, 0);
    // point (10, 0) in the rotated frame → after rotate becomes (0,10) then translate → (10,10)
    const [x2, y2] = applyMatrixToPoint(m, [10, 0]);
    expectClose(x2, 10);
    expectClose(y2, 10);
  });

  it("parses matrix(a b c d e f)", () => {
    const m = parseTransform("matrix(2, 0, 0, 2, 10, 10)");
    const [x, y] = applyMatrixToPoint(m, [5, 5]);
    expectClose(x, 20);
    expectClose(y, 20);
  });

  it("parses skewX", () => {
    const m = parseTransform("skewX(45)");
    const [x, y] = applyMatrixToPoint(m, [10, 0]);
    expectClose(x, 10);
    expectClose(y, 0);
    const [x2, y2] = applyMatrixToPoint(m, [0, 10]);
    expectClose(x2, 10);
    expectClose(y2, 10);
  });

  it("returns identity for empty/missing transform", () => {
    expect(parseTransform("")).toEqual(IDENTITY_MATRIX);
    expect(parseTransform(null)).toEqual(IDENTITY_MATRIX);
    expect(parseTransform(undefined)).toEqual(IDENTITY_MATRIX);
  });

  it("isIdentity detects identity matrices", () => {
    expect(isIdentity(IDENTITY_MATRIX)).toBe(true);
    expect(isIdentity(parseTransform("translate(0.0001, 0)"))).toBe(false);
  });
});

describe("applyMatrixToPoint", () => {
  it("applies a full matrix", () => {
    const m: TransformMatrix = { a: 2, b: 0, c: 1, d: 3, e: 5, f: 6 };
    const [x, y] = applyMatrixToPoint(m, [1, 2]);
    // x' = a*x + c*y + e = 2*1 + 1*2 + 5 = 9
    // y' = b*x + d*y + f = 0 + 3*2 + 6 = 12
    expectClose(x, 9);
    expectClose(y, 12);
  });
});

describe("decomposeMatrix", () => {
  it("extracts translation, scale, rotation", () => {
    // scale(2,3) then rotate(90): the transformed x-axis is length 3,
    // the transformed y-axis is length 2 (axes swap under 90° rotation)
    const m = parseTransform("translate(10, 20) scale(2, 3) rotate(90)");
    const d = decomposeMatrix(m);
    expectClose(d.translateX, 10);
    expectClose(d.translateY, 20);
    expectClose(d.scaleX, 3);
    expectClose(d.scaleY, 2);
    expectClose(d.rotationDeg, 90);
    expect(d.skewDeg).toBeCloseTo(0, 5);
  });

  it("extracts rotation about center as pure rotation", () => {
    const m = parseTransform("rotate(45, 100, 100)");
    const d = decomposeMatrix(m);
    expectClose(d.rotationDeg, 45);
    // translate components: point (100,100) must stay fixed
    const [x, y] = applyMatrixToPoint(m, [100, 100]);
    expectClose(x, 100);
    expectClose(y, 100);
  });

  it("detects skew", () => {
    const m = parseTransform("skewX(30)");
    const d = decomposeMatrix(m);
    expect(Math.abs(d.skewDeg)).toBeGreaterThan(1);
  });
});

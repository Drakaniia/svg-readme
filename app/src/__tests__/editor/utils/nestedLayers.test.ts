import { describe, it, expect } from "vitest";
import { duplicateLayersWithChildren } from "../../../lib/editor/documentActions";
import { smartDelete } from "../../../lib/editor/layerOps/smartDelete";
import type { LayerType } from "../../../context/EditorContext";
import type { ElementProperties } from "../../../components/editor-canvas/ElementsRenderer";

function shapeLayer(id: string, overrides?: Partial<LayerType>): LayerType {
  return {
    id,
    name: id,
    type: "shape",
    locked: false,
    visible: true,
    ...overrides,
  };
}

function shapeProps(_id: string): ElementProperties {
  return {
    type: "shape",
    kind: "rect",
    x: 10,
    y: 10,
    width: 50,
    height: 30,
    fill: "#fff",
    stroke: "none",
    strokeWidth: 0,
    opacity: 1,
  };
}

/** A group with two children, plus one root-level shape. */
function nestedFixture() {
  const layers: LayerType[] = [
    shapeLayer("g1", { type: "group" }),
    shapeLayer("child-a", { parentId: "g1" }),
    shapeLayer("child-b", { parentId: "g1" }),
    shapeLayer("root"),
  ];
  const props: Record<string, ElementProperties> = {
    "child-a": shapeProps("child-a"),
    "child-b": shapeProps("child-b"),
    root: shapeProps("root"),
  };
  return { layers, props };
}

describe("duplicateLayersWithChildren — nested-layer parentId correctness (A7)", () => {
  it("duplicates the group AND its children, remapping child parentIds to the new group", () => {
    const { layers, props } = nestedFixture();
    const result = duplicateLayersWithChildren(layers, props, ["g1"]);
    expect(result).not.toBeNull();

    const { duplicatedLayers, duplicatedTopIds } = result!;
    // Group + both children duplicated; the root layer is untouched.
    expect(duplicatedLayers).toHaveLength(3);
    expect(duplicatedTopIds).toHaveLength(1);

    const dupGroup = duplicatedLayers.find((l) => l.type === "group")!;
    const dupChildren = duplicatedLayers.filter((l) => l.parentId === dupGroup.id);
    expect(dupChildren).toHaveLength(2);

    // No duplicated child points at the ORIGINAL group id.
    const originalGroupId = "g1";
    const stray = duplicatedLayers.filter(
      (l) => l.parentId === originalGroupId,
    );
    expect(stray).toHaveLength(0);
  });

  it("duplicating a deep selection also carries nested grandchildren", () => {
    const layers: LayerType[] = [
      shapeLayer("g1", { type: "group" }),
      shapeLayer("child-a", { parentId: "g1" }),
      shapeLayer("sub", { type: "group", parentId: "child-a" }),
      shapeLayer("grandchild", { parentId: "sub" }),
    ];
    const props: Record<string, ElementProperties> = {
      "child-a": shapeProps("child-a"),
      grandchild: shapeProps("grandchild"),
    };
    const result = duplicateLayersWithChildren(layers, props, ["child-a"]);
    expect(result).not.toBeNull();
    const { duplicatedLayers } = result!;

    const dupSub = duplicatedLayers.find((l) => l.type === "group" && l.id !== "g1")!;
    // Grandchild's parentId points at the duplicated subgroup, not the original.
    const dupGrandchild = duplicatedLayers.find((l) => l.parentId === dupSub.id);
    expect(dupGrandchild).toBeDefined();
  });

  it("paste-remap keeps children under the pasted group even after the original group is deleted", () => {
    // Simulate: user copied a group + children, then deleted the original.
    const clipboardLayers: LayerType[] = [
      shapeLayer("g1", { type: "group" }),
      shapeLayer("child-a", { parentId: "g1" }),
      shapeLayer("child-b", { parentId: "g1" }),
    ];
    const clipboardProps: Record<string, ElementProperties> = {
      "child-a": shapeProps("child-a"),
      "child-b": shapeProps("child-b"),
    };

    const result = duplicateLayersWithChildren(
      clipboardLayers,
      clipboardProps,
      clipboardLayers.map((l) => l.id),
    );
    expect(result).not.toBeNull();
    const { duplicatedLayers } = result!;

    // No pasted layer references the original group id.
    const orphans = duplicatedLayers.filter((l) => l.parentId === "g1");
    expect(orphans).toHaveLength(0);
    // Every pasted child lives under the pasted group.
    const dupGroup = duplicatedLayers.find((l) => l.type === "group")!;
    const children = duplicatedLayers.filter((l) => l.parentId === dupGroup.id);
    expect(children).toHaveLength(2);
  });
});

describe("smartDelete — group deletion removes descendants (A7)", () => {
  it("deleting a group removes its children and grandchildren too", () => {
    const layers: LayerType[] = [
      shapeLayer("g1", { type: "group" }),
      shapeLayer("child-a", { parentId: "g1" }),
      shapeLayer("sub", { type: "group", parentId: "child-a" }),
      shapeLayer("grandchild", { parentId: "sub" }),
      shapeLayer("root"),
    ];
    const props: Record<string, ElementProperties> = {
      "child-a": shapeProps("child-a"),
      grandchild: shapeProps("grandchild"),
      root: shapeProps("root"),
    };

    const result = smartDelete(layers, props, ["g1"]);
    expect(result).not.toBeNull();
    const remaining = result!.updatedLayers.map((l) => l.id);
    expect(remaining).toEqual(["root"]);
    // Element properties for removed descendants are cleaned up.
    expect(result!.updatedProperties["child-a"]).toBeUndefined();
    expect(result!.updatedProperties["grandchild"]).toBeUndefined();
    expect(result!.updatedProperties["root"]).toBeDefined();
  });

  it("deleting a child inside a group leaves the group and siblings intact", () => {
    const { layers, props } = nestedFixture();
    const result = smartDelete(layers, props, ["child-a"]);
    expect(result).not.toBeNull();
    const ids = result!.updatedLayers.map((l) => l.id);
    expect(ids).toContain("g1");
    expect(ids).toContain("child-b");
    expect(ids).not.toContain("child-a");
  });
});

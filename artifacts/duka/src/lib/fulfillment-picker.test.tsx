import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { FULFILLMENT_OPTIONS, FulfillmentPickerCell } from "../App";
import type { Order } from "@workspace/api-client-react";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function setupDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/",
  });
  const previousGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
  };

  Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: dom.window.HTMLElement });
  Object.defineProperty(globalThis, "Node", { configurable: true, value: dom.window.Node });

  const rootElement = dom.window.document.getElementById("root");
  assert.ok(rootElement, "Root element must exist");
  const root = createRoot(rootElement);

  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    rootElement,
    root,
    cleanup() {
      act(() => {
        root.unmount();
      });
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousGlobals.window });
      Object.defineProperty(globalThis, "document", { configurable: true, value: previousGlobals.document });
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: previousGlobals.navigator });
      Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: previousGlobals.HTMLElement });
      Object.defineProperty(globalThis, "Node", { configurable: true, value: previousGlobals.Node });
      dom.window.close();
    },
  };
}

const mockOrder: Order = {
  id: 42,
  token: "abc12345",
  productId: 1,
  productName: "Premium Silk Scarf",
  customerName: "Ama Mensah",
  customerPhone: "0241234567",
  channel: "whatsapp",
  amount: 250,
  deliveryFee: 20,
  deliveryMethod: "delivery",
  deliveryAddress: "Airport Hills, House 12, Accra",
  productCost: 120,
  depositAmount: 100,
  paymentMode: "deposit",
  status: "deposit_paid",
  fulfillment: "pending",
  createdAt: "2026-09-27T10:00:00Z",
  linkOpens: 1,
  shares: 0,
  likes: 0,
  engagementSource: null,
  referenceImage: null,
  buyerDetails: null,
  items: [],
};

test("FULFILLMENT_OPTIONS defines pending, shipped, and delivered with correct labels and hints", () => {
  assert.equal(FULFILLMENT_OPTIONS.length, 3);
  const values = FULFILLMENT_OPTIONS.map((o) => o.value);
  assert.deepEqual(values, ["pending", "shipped", "delivered"]);

  const pendingOpt = FULFILLMENT_OPTIONS.find((o) => o.value === "pending");
  assert.equal(pendingOpt?.label, "To ship");
  assert.ok(pendingOpt?.hint.includes("dispatch") || pendingOpt?.hint.includes("packing"));

  const shippedOpt = FULFILLMENT_OPTIONS.find((o) => o.value === "shipped");
  assert.equal(shippedOpt?.label, "Shipped");
  assert.ok(shippedOpt?.hint.includes("transit") || shippedOpt?.hint.includes("courier"));

  const deliveredOpt = FULFILLMENT_OPTIONS.find((o) => o.value === "delivered");
  assert.equal(deliveredOpt?.label, "Delivered");
  assert.ok(deliveredOpt?.hint.includes("customer") || deliveredOpt?.hint.includes("delivery"));
});

test("FulfillmentPickerCell renders trigger with active status label and chevron for pending", () => {
  const env = setupDom();
  try {
    act(() => {
      env.root.render(
        createElement(FulfillmentPickerCell, {
          order: mockOrder,
          disabled: false,
          onUpdateFulfillment: () => {},
        })
      );
    });

    const button = env.document.querySelector<HTMLButtonElement>(
      `[data-testid="button-fulfillment-${mockOrder.id}"]`
    );
    assert.ok(button, "Fulfillment trigger button should be rendered");
    assert.match(button.textContent ?? "", /To ship/);
    assert.equal(button.getAttribute("title"), "Hover to view fulfillment options");

    const chevron = button.querySelector("svg");
    assert.ok(chevron, "Chevron icon should be present");
  } finally {
    env.cleanup();
  }
});

test("FulfillmentPickerCell updates label and tone when order is shipped", () => {
  const env = setupDom();
  try {
    const shippedOrder: Order = { ...mockOrder, fulfillment: "shipped" };
    act(() => {
      env.root.render(
        createElement(FulfillmentPickerCell, {
          order: shippedOrder,
          disabled: false,
          onUpdateFulfillment: () => {},
        })
      );
    });

    const button = env.document.querySelector<HTMLButtonElement>(
      `[data-testid="button-fulfillment-${shippedOrder.id}"]`
    );
    assert.ok(button, "Fulfillment trigger button should be rendered");
    assert.match(button.textContent ?? "", /Shipped/);

    const pill = button.querySelector("[data-tone]");
    assert.equal(pill?.getAttribute("data-tone"), "blue");
  } finally {
    env.cleanup();
  }
});

test("FulfillmentPickerCell updates label and tone when order is delivered", () => {
  const env = setupDom();
  try {
    const deliveredOrder: Order = { ...mockOrder, fulfillment: "delivered" };
    act(() => {
      env.root.render(
        createElement(FulfillmentPickerCell, {
          order: deliveredOrder,
          disabled: false,
          onUpdateFulfillment: () => {},
        })
      );
    });

    const button = env.document.querySelector<HTMLButtonElement>(
      `[data-testid="button-fulfillment-${deliveredOrder.id}"]`
    );
    assert.ok(button, "Fulfillment trigger button should be rendered");
    assert.match(button.textContent ?? "", /Delivered/);

    const pill = button.querySelector("[data-tone]");
    assert.equal(pill?.getAttribute("data-tone"), "mint");
  } finally {
    env.cleanup();
  }
});

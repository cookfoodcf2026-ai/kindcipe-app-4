import { chatSessionSignature } from "./chatSessionSignature";

const session = {
  title: "今晚食乜",
  messages: [
    { role: "user", content: "三餸一湯" },
    { role: "assistant", content: [{ type: "text", text: "好" }] },
  ],
};

describe("chatSessionSignature", () => {
  it("is stable for identical content across new object identities", () => {
    const copy = JSON.parse(JSON.stringify(session));
    expect(chatSessionSignature(copy)).toBe(chatSessionSignature(session));
  });

  it("changes when a message is added", () => {
    const next = {
      ...session,
      messages: [...session.messages, { role: "user" as const, content: "少辣" }],
    };
    expect(chatSessionSignature(next)).not.toBe(chatSessionSignature(session));
  });

  it("changes when the title changes", () => {
    expect(chatSessionSignature({ ...session, title: "新對話" })).not.toBe(
      chatSessionSignature(session),
    );
  });
});

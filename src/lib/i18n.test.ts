import { describe, expect, it } from "vitest";
import { translate } from "./i18n";

describe("i18n", () => {
  it("translates supported interface labels to Chinese", () => {
    expect(translate("Settings", "zh")).toBe("设置");
    expect(translate("Search chats...", "zh")).toBe("搜索聊天记录…");
  });

  it("keeps English labels unchanged", () => {
    expect(translate("Settings", "en")).toBe("Settings");
  });

  it("leaves user-generated text unchanged when no translation exists", () => {
    expect(translate("my-project-name", "zh")).toBe("my-project-name");
  });
});

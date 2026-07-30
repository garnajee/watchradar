import { describe, expect, it } from "vitest";
import { localeDictionaries, translate, translationKeys } from "./i18n";

describe("localization dictionaries", () => {
  it("contains exactly the same keys in English and French", () => {
    expect(translationKeys(localeDictionaries.fr)).toEqual(
      translationKeys(localeDictionaries.en)
    );
  });

  it("interpolates translated values", () => {
    expect(translate("en", "dashboard.offlineNow", { name: "Ada" })).toBe(
      "Ada is offline right now."
    );
    expect(translate("fr", "dashboard.offlineNow", { name: "Ada" })).toBe(
      "Ada est hors ligne pour le moment."
    );
  });
});

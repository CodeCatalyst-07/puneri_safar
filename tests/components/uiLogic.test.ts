import { describe, it, expect } from "vitest";
import { isWithinPuneBounds } from "@/core/geo";
import { SHIVAJINAGAR_DEFAULT } from "@/components/useUserContext";

describe("UI Logic & Presentation Rules", () => {
  describe("Geolocation Fallback Rules", () => {
    it("recognizes Shivajinagar default coordinates as valid inside Pune", () => {
      expect(isWithinPuneBounds(SHIVAJINAGAR_DEFAULT)).toBe(true);
      expect(SHIVAJINAGAR_DEFAULT.lat).toBe(18.5314);
      expect(SHIVAJINAGAR_DEFAULT.lng).toBe(73.8446);
    });

    it("rejects coordinates outside Pune bounds (e.g. Mumbai, Delhi, London)", () => {
      const mumbai = { lat: 19.076, lng: 72.8777 };
      const delhi = { lat: 28.6139, lng: 77.209 };
      const london = { lat: 51.5074, lng: -0.1278 };

      expect(isWithinPuneBounds(mumbai)).toBe(false);
      expect(isWithinPuneBounds(delhi)).toBe(false);
      expect(isWithinPuneBounds(london)).toBe(false);
    });

    it("accepts core Pune neighborhoods within PMRDA boundaries", () => {
      const katraj = { lat: 18.4552, lng: 73.8568 };
      const hinjewadi = { lat: 18.5913, lng: 73.7389 };
      const kothrud = { lat: 18.5074, lng: 73.8077 };
      const vimanNagar = { lat: 18.5679, lng: 73.9143 };

      expect(isWithinPuneBounds(katraj)).toBe(true);
      expect(isWithinPuneBounds(hinjewadi)).toBe(true);
      expect(isWithinPuneBounds(kothrud)).toBe(true);
      expect(isWithinPuneBounds(vimanNagar)).toBe(true);
    });
  });

  describe("'No data' Rendering Rules (Never 0 for missing data)", () => {
    function formatPriceLevel(priceLevel?: number | null): string {
      if (priceLevel !== undefined && priceLevel !== null && priceLevel > 0) {
        return "₹".repeat(priceLevel);
      }
      return "No data";
    }

    function formatAccessibility(hasWheelchairEntrance?: boolean): string {
      if (hasWheelchairEntrance === true) return "Wheelchair Accessible";
      if (hasWheelchairEntrance === false) return "Not accessible";
      return "No data";
    }

    it("formats known price levels to rupee symbols", () => {
      expect(formatPriceLevel(1)).toBe("₹");
      expect(formatPriceLevel(2)).toBe("₹₹");
      expect(formatPriceLevel(3)).toBe("₹₹₹");
      expect(formatPriceLevel(4)).toBe("₹₹₹₹");
    });

    it("renders undefined or null price as 'No data', NEVER as 0 or empty", () => {
      expect(formatPriceLevel(undefined)).toBe("No data");
      expect(formatPriceLevel(null)).toBe("No data");
      expect(formatPriceLevel(0)).toBe("No data");
    });

    it("renders undefined accessibility as 'No data'", () => {
      expect(formatAccessibility(undefined)).toBe("No data");
      expect(formatAccessibility(true)).toBe("Wheelchair Accessible");
      expect(formatAccessibility(false)).toBe("Not accessible");
    });
  });
});

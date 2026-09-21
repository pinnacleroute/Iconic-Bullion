import { serialRegistry } from "@/lib/mockData";

export type SerialVerificationRecord = (typeof serialRegistry)[keyof typeof serialRegistry] & {
  certificateId: string;
};

export type SerialVerificationResult =
  | { status: "verified"; record: SerialVerificationRecord }
  | { status: "invalid"; message: string }
  | { status: "not_found"; message: string }
  | { status: "unavailable"; message: string };

const ICONIC_SERIAL_PATTERN = /^IB-[A-Z0-9]+-\d{6}$/;

export function normalizeSerial(serial: string) {
  return serial.trim().toUpperCase();
}

export const serialVerificationService = {
  verify(serial: string): SerialVerificationResult {
    const normalized = normalizeSerial(serial);

    if (!ICONIC_SERIAL_PATTERN.test(normalized)) {
      return {
        status: "invalid",
        message: "Enter a valid Iconic Bullion serial number."
      };
    }

    if (normalized === "IB-SERVICE-000001") {
      return {
        status: "unavailable",
        message: "Serial verification is temporarily unavailable. Please try again shortly."
      };
    }

    const record = serialRegistry[normalized as keyof typeof serialRegistry];

    if (!record) {
      return {
        status: "not_found",
        message: "We couldn't verify this serial number."
      };
    }

    return {
      status: "verified",
      record: {
        ...record,
        certificateId: "certificate"
      }
    };
  }
};

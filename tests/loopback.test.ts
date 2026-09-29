import { describe, expect, test } from "bun:test";
import { isLoopbackPeer } from "../src/map/loopback.ts";

describe("isLoopbackPeer", () => {
  test("true for IPv4/IPv6 loopback including mapped v4", () => {
    expect(isLoopbackPeer("127.0.0.1")).toBe(true);
    expect(isLoopbackPeer("127.255.255.254")).toBe(true);
    expect(isLoopbackPeer("::1")).toBe(true);
    expect(isLoopbackPeer("[::1]")).toBe(true);
    expect(isLoopbackPeer("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackPeer("localhost")).toBe(true);
  });

  test("false for empty and non-loopback", () => {
    expect(isLoopbackPeer(null)).toBe(false);
    expect(isLoopbackPeer("")).toBe(false);
    expect(isLoopbackPeer("10.0.0.1")).toBe(false);
    expect(isLoopbackPeer("192.168.1.9")).toBe(false);
    expect(isLoopbackPeer("::ffff:10.0.0.1")).toBe(false);
    expect(isLoopbackPeer("8.8.8.8")).toBe(false);
  });
});

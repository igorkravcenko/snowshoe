import { describe, expect, test } from "bun:test";
import { isLoopbackHost, isLoopbackPeer } from "../src/map/loopback.ts";

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

describe("isLoopbackHost", () => {
  test("accepts loopback names and host:port", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("127.0.0.1:8787")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("localhost:8787")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("[::1]:8787")).toBe(true);
  });

  test("rejects wildcards, LAN, empty", () => {
    expect(isLoopbackHost(null)).toBe(false);
    expect(isLoopbackHost("")).toBe(false);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("::")).toBe(false);
    expect(isLoopbackHost("*")).toBe(false);
    expect(isLoopbackHost("10.0.0.1")).toBe(false);
    expect(isLoopbackHost("evil.example:8787")).toBe(false);
    expect(isLoopbackHost("192.168.1.9:8787")).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import {
  httpOriginForBind,
  isAllowedMapOrigin,
  isLoopbackHost,
  isLoopbackPeer,
  loopbackOriginsForPort,
} from "../src/map/loopback.ts";

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
    expect(isLoopbackHost("127.0.0.1:3232")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("localhost:3232")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("[::1]:3232")).toBe(true);
  });

  test("rejects wildcards, LAN, empty", () => {
    expect(isLoopbackHost(null)).toBe(false);
    expect(isLoopbackHost("")).toBe(false);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("::")).toBe(false);
    expect(isLoopbackHost("*")).toBe(false);
    expect(isLoopbackHost("10.0.0.1")).toBe(false);
    expect(isLoopbackHost("evil.example:3232")).toBe(false);
    expect(isLoopbackHost("192.168.1.9:3232")).toBe(false);
  });
});

describe("loopback Origins for map serve", () => {
  test("exact match on the bound port only", () => {
    const origins = loopbackOriginsForPort(3232);
    expect(origins.has("http://127.0.0.1:3232")).toBe(true);
    expect(origins.has("http://localhost:3232")).toBe(true);
    expect(origins.has("http://[::1]:3232")).toBe(true);
    expect(isAllowedMapOrigin("http://127.0.0.1:3232", 3232)).toBe(true);
    expect(isAllowedMapOrigin("http://127.0.0.1:3232/", 3232)).toBe(false);
    expect(isAllowedMapOrigin("http://127.0.0.1:9999", 3232)).toBe(false);
    expect(isAllowedMapOrigin("http://127.0.0.1.evil.example:3232", 3232)).toBe(false);
    expect(isAllowedMapOrigin("https://127.0.0.1:3232", 3232)).toBe(false);
    expect(isAllowedMapOrigin(null, 3232)).toBe(false);
    expect(isAllowedMapOrigin("", 3232)).toBe(false);
    expect(httpOriginForBind("127.0.0.1", 3232)).toBe("http://127.0.0.1:3232");
    expect(httpOriginForBind("::1", 3232)).toBe("http://[::1]:3232");
  });
});

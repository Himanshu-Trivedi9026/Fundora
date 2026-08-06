/**
 * lib/roles.js — platform role constants, access rules, and route protection.
 */
import {
  ROLES,
  ROLE_LABELS,
  ROLE_HOME,
  roleHome,
  roleLabel,
  parseSignupRole,
  AREA_ROLES,
  canAccessArea,
  canStartProject,
  startProjectHref,
  protectedArea,
} from "@/lib/roles";

describe("ROLES constants", () => {
  it("exposes the three platform roles with their storage values", () => {
    expect(ROLES).toEqual({
      INVESTOR: "donor",
      CREATOR: "creator",
      ADMIN: "platform_admin",
    });
  });
});

describe("roleLabel / roleHome", () => {
  it("labels roles with the product names (Investor/Creator/Admin)", () => {
    expect(roleLabel(ROLES.INVESTOR)).toBe("Investor");
    expect(roleLabel(ROLES.CREATOR)).toBe("Creator");
    expect(roleLabel(ROLES.ADMIN)).toBe("Admin");
  });

  it("falls back to Investor for unknown roles", () => {
    expect(roleLabel("superuser")).toBe("Investor");
  });

  it("maps each role to its dashboard home", () => {
    expect(ROLE_HOME[ROLES.INVESTOR]).toBe("/investor/dashboard");
    expect(ROLE_HOME[ROLES.CREATOR]).toBe("/creator/dashboard");
    expect(ROLE_HOME[ROLES.ADMIN]).toBe("/admin/dashboard");
    expect(roleHome("unknown")).toBe("/investor/dashboard");
  });
});

describe("parseSignupRole", () => {
  it("maps the exact 'creator' string to the creator role", () => {
    expect(parseSignupRole("creator")).toBe(ROLES.CREATOR);
  });

  it("defaults every other value to the investor role", () => {
    expect(parseSignupRole(undefined)).toBe(ROLES.INVESTOR);
    expect(parseSignupRole(null)).toBe(ROLES.INVESTOR);
    expect(parseSignupRole("")).toBe(ROLES.INVESTOR);
    expect(parseSignupRole("donor")).toBe(ROLES.INVESTOR);
    expect(parseSignupRole("admin")).toBe(ROLES.INVESTOR);
    expect(parseSignupRole("platform_admin")).toBe(ROLES.INVESTOR);
    expect(parseSignupRole("CREATOR")).toBe(ROLES.INVESTOR);
  });

  it("fails closed on repeated-query arrays so self-elevation is impossible", () => {
    expect(parseSignupRole(["creator"])).toBe(ROLES.INVESTOR);
    expect(parseSignupRole(["platform_admin"])).toBe(ROLES.INVESTOR);
  });
});

describe("canAccessArea", () => {
  it("lets every signed-in role into the investor area", () => {
    for (const role of Object.values(ROLES)) {
      expect(canAccessArea(role, "investor")).toBe(true);
    }
  });

  it("lets only creators and admins into the creator area", () => {
    expect(canAccessArea(ROLES.CREATOR, "creator")).toBe(true);
    expect(canAccessArea(ROLES.ADMIN, "creator")).toBe(true);
    expect(canAccessArea(ROLES.INVESTOR, "creator")).toBe(false);
  });

  it("lets only admins into the admin area", () => {
    expect(canAccessArea(ROLES.ADMIN, "admin")).toBe(true);
    expect(canAccessArea(ROLES.CREATOR, "admin")).toBe(false);
    expect(canAccessArea(ROLES.INVESTOR, "admin")).toBe(false);
  });

  it("defaults unknown areas to investor rules", () => {
    expect(canAccessArea(ROLES.INVESTOR, "nope")).toBe(true);
    expect(canAccessArea(ROLES.ADMIN, "nope")).toBe(true);
  });

  it("matches AREA_ROLES declarations", () => {
    expect(AREA_ROLES.investor).toEqual([
      ROLES.INVESTOR,
      ROLES.CREATOR,
      ROLES.ADMIN,
    ]);
    expect(AREA_ROLES.creator).toEqual([ROLES.CREATOR, ROLES.ADMIN]);
    expect(AREA_ROLES.admin).toEqual([ROLES.ADMIN]);
  });
});

describe("canStartProject / startProjectHref (create-flow affordances)", () => {
  it("only lets creators see a Start Project affordance", () => {
    expect(canStartProject({ role: ROLES.CREATOR })).toBe(true);
    expect(canStartProject({ role: ROLES.INVESTOR })).toBe(false);
    expect(canStartProject({ role: ROLES.ADMIN })).toBe(false);
    // Guest state (no signed-in user) resolves to the investor role in
    // RoleContext, so a guest can never start a project.
    expect(canStartProject({})).toBe(false);
    expect(canStartProject({ role: undefined })).toBe(false);
  });

  it("sends creators into the creation flow and everyone else to /get-started", () => {
    expect(startProjectHref({ role: ROLES.CREATOR })).toBe("/create");
    expect(startProjectHref({ role: ROLES.INVESTOR })).toBe("/get-started");
    expect(startProjectHref({ role: ROLES.ADMIN })).toBe("/get-started");
    // Defensive: a guest hitting a stray Start Project link lands on
    // /get-started, never the auth-gated /create page.
    expect(startProjectHref({})).toBe("/get-started");
  });
});

describe("protectedArea (middleware routing)", () => {
  it("leaves public paths unprotected", () => {
    expect(protectedArea("/")).toBeNull();
    expect(protectedArea("/explore")).toBeNull();
    expect(protectedArea("/projects/abc")).toBeNull();
    expect(protectedArea("/login")).toBeNull();
  });

  it("marks /create and /edit as auth-only", () => {
    expect(protectedArea("/create")).toEqual({ authOnly: true });
    expect(protectedArea("/create/new")).toEqual({ authOnly: true });
    expect(protectedArea("/edit/xyz")).toEqual({ authOnly: true });
  });

  it.each(["investor", "creator", "admin"])(
    "gates the %s area by role",
    (area) => {
      expect(protectedArea(`/${area}`)).toEqual({ area });
      expect(protectedArea(`/${area}/dashboard`)).toEqual({ area });
      expect(protectedArea(`/${area}/nested/deep`)).toEqual({ area });
    },
  );

  it("does not confuse a public path that merely starts with a keyword", () => {
    expect(protectedArea("/creatorize")).toBeNull();
    expect(protectedArea("/adminish/thing")).toBeNull();
    expect(protectedArea("/investor-faq")).toBeNull();
  });
});

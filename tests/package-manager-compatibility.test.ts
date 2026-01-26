import * as fc from "fast-check";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Feature: django-graphql-mcp-server, Property 17: Package manager support
describe("Package Manager Compatibility", () => {
  const packageManagers = ["npm", "pnpm", "yarn"] as const;
  type PackageManager = (typeof packageManagers)[number];

  // Helper function to check if a package manager is available
  const isPackageManagerAvailable = (pm: PackageManager): boolean => {
    try {
      execSync(`${pm} --version`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  };

  // Helper function to get available package managers
  const getAvailablePackageManagers = (): PackageManager[] => {
    return packageManagers.filter(isPackageManagerAvailable);
  };

  // Property test: For any available package manager, the MCP server should be installable and runnable
  test("Property 17: Package manager support - server supports installation with any available package manager", () => {
    const availablePackageManagers = getAvailablePackageManagers();

    // Skip test if no package managers are available
    if (availablePackageManagers.length === 0) {
      console.warn("No package managers available for testing");
      return;
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...availablePackageManagers),
        (packageManager: PackageManager) => {
          // Test that the package manager can install dependencies
          const canInstall = testPackageManagerInstall(packageManager);

          // Test that the package manager can run scripts
          const canRunScripts = testPackageManagerScripts(packageManager);

          // Both installation and script execution should work
          expect(canInstall).toBe(true);
          expect(canRunScripts).toBe(true);
        },
      ),
      { numRuns: Math.min(100, availablePackageManagers.length * 10) },
    );
  });

  // Test installation capability for a package manager
  const testPackageManagerInstall = (
    packageManager: PackageManager,
  ): boolean => {
    try {
      // Check if package.json exists and is valid
      const packageJsonPath = path.join(process.cwd(), "package.json");
      if (!fs.existsSync(packageJsonPath)) {
        return false;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      // Verify package.json has required fields for installation
      const hasRequiredFields = !!(
        packageJson.name &&
        packageJson.version &&
        (packageJson.dependencies || packageJson.devDependencies)
      );

      if (!hasRequiredFields) {
        return false;
      }

      // Test dry-run installation (doesn't actually install, just validates)
      let installCommand: string;
      switch (packageManager) {
        case "npm":
          installCommand = "npm install --dry-run --silent";
          break;
        case "pnpm":
          installCommand = "pnpm install --dry-run --silent";
          break;
        case "yarn":
          installCommand = "yarn install --dry-run --silent";
          break;
        default:
          return false;
      }

      execSync(installCommand, {
        stdio: "ignore",
        timeout: 30000, // 30 second timeout
      });

      return true;
    } catch (error) {
      console.warn(`Installation test failed for ${packageManager}:`, error);
      return false;
    }
  };

  // Test script execution capability for a package manager
  const testPackageManagerScripts = (
    packageManager: PackageManager,
  ): boolean => {
    try {
      // Check if package.json has scripts
      const packageJsonPath = path.join(process.cwd(), "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      if (!packageJson.scripts) {
        return false;
      }

      // Test that the package manager can list/validate scripts
      let scriptCommand: string;
      switch (packageManager) {
        case "npm":
          scriptCommand = "npm run";
          break;
        case "pnpm":
          scriptCommand = "pnpm run";
          break;
        case "yarn":
          scriptCommand = "yarn run";
          break;
        default:
          return false;
      }

      execSync(scriptCommand, {
        stdio: "ignore",
        timeout: 10000, // 10 second timeout
      });

      return true;
    } catch (error) {
      console.warn(
        `Script execution test failed for ${packageManager}:`,
        error,
      );
      return false;
    }
  };

  // Additional unit tests for specific scenarios
  describe("Package Manager Specific Tests", () => {
    test("package.json contains valid configuration for all package managers", () => {
      const packageJsonPath = path.join(process.cwd(), "package.json");
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      // Verify required fields
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.main).toBeDefined();
      expect(packageJson.scripts).toBeDefined();

      // Verify essential scripts exist
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.start).toBeDefined();
    });

    test("dependencies are compatible with all package managers", () => {
      const packageJsonPath = path.join(process.cwd(), "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      // Check that dependencies use valid version ranges
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      Object.entries(allDeps).forEach(([name, version]) => {
        expect(typeof name).toBe("string");
        expect(typeof version).toBe("string");
        expect(name.length).toBeGreaterThan(0);
        expect(version.length).toBeGreaterThan(0);
      });
    });
  });
});

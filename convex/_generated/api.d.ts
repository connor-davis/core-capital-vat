/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authHelpers from "../authHelpers.js";
import type * as crons from "../crons.js";
import type * as migrations from "../migrations.js";
import type * as organizations from "../organizations.js";
import type * as qa from "../qa.js";
import type * as reporting from "../reporting.js";
import type * as retention from "../retention.js";
import type * as rubrics from "../rubrics.js";
import type * as userSync from "../userSync.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as videoProcessing from "../videoProcessing.js";
import type * as videos from "../videos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  authHelpers: typeof authHelpers;
  crons: typeof crons;
  migrations: typeof migrations;
  organizations: typeof organizations;
  qa: typeof qa;
  reporting: typeof reporting;
  retention: typeof retention;
  rubrics: typeof rubrics;
  userSync: typeof userSync;
  users: typeof users;
  validators: typeof validators;
  videoProcessing: typeof videoProcessing;
  videos: typeof videos;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

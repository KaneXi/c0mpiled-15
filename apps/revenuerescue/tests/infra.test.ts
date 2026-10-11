import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const template = JSON.parse(readFileSync(new URL("../../../infra/aws.json", import.meta.url), "utf8"));
const resources = template.Resources as Record<string, { Type: string; Properties: Record<string, unknown> }>;
const distribution = template.Resources.Distribution.Properties.DistributionConfig;

describe("public delivery safety boundaries", () => {
  it("keeps S3 private and grants read access only to this CloudFront distribution", () => {
    expect(resources.SiteBucket.Properties.PublicAccessBlockConfiguration).toEqual({ BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true });
    expect(resources.SiteOAC.Properties.OriginAccessControlConfig).toMatchObject({ OriginAccessControlOriginType: "s3", SigningBehavior: "always", SigningProtocol: "sigv4" });
    expect(template.Resources.BucketPolicy.Properties.PolicyDocument.Statement).toHaveLength(1);
    expect(template.Resources.BucketPolicy.Properties.PolicyDocument.Statement[0]).toMatchObject({ Principal: { Service: "cloudfront.amazonaws.com" }, Action: "s3:GetObject", Condition: { StringEquals: { "AWS:SourceArn": { "Fn::Sub": "arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${Distribution}" } } } });
  });

  it("keeps cookie-bearing API responses uncached and separate from static rewrites", () => {
    const behaviors = distribution.CacheBehaviors as { PathPattern: string; TargetOriginId: string; CachePolicyId: string; OriginRequestPolicyId: string; FunctionAssociations?: unknown }[];
    const api = behaviors.find((item) => item.PathPattern === "/api/*");
    expect(api).toMatchObject({ TargetOriginId: "AgentAPI", CachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", OriginRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac" });
    expect(api?.FunctionAssociations).toBeUndefined();
    expect(distribution.CustomErrorResponses).toBeUndefined();
    const origins = distribution.Origins as { Id: string; OriginCustomHeaders?: unknown }[];
    expect(origins.find((item) => item.Id === "AgentAPI")?.OriginCustomHeaders).toEqual([{ HeaderName: "x-origin-verify", HeaderValue: { Ref: "OriginSecret" } }]);
    expect(template.Parameters.OriginSecret).toMatchObject({ NoEcho: true, MinLength: 32 });
  });

  it("exposes only Relay session, state and command routes and throttles admission", () => {
    const routes = Object.values(resources).filter((item) => item.Type === "AWS::ApiGatewayV2::Route").map((item) => item.Properties.RouteKey);
    expect(routes.sort()).toEqual(["GET /api/relay/state", "POST /api/relay/command", "POST /api/relay/session"]);
    expect(resources.Stage.Properties.DefaultRouteSettings).toMatchObject({ ThrottlingBurstLimit: 2, ThrottlingRateLimit: 1 });
    expect(resources.Integration.Properties.TimeoutInMillis).toBeGreaterThan(Number(resources.AgentFunction.Properties.Timeout) * 1000);
    expect(template.Parameters.AgentEnabled.Default).toBe("false");
  });

  it("maps extensionless exported pages without rewriting existing asset paths", () => {
    const source = String(resources.StaticRewrite.Properties.FunctionCode);
    const rewrite = (uri: string) => runInNewContext(`${source}; handler({request:{uri: input}}).uri`, { input: uri }, { timeout: 100 });
    expect(rewrite("/")).toBe("/index.html");
    expect(rewrite("/demo")).toBe("/demo.html");
    expect(rewrite("/demo/")).toBe("/demo.html");
    expect(rewrite("/_next/static/chunks/app.js")).toBe("/_next/static/chunks/app.js");
    expect(rewrite("/fonts/body.woff2")).toBe("/fonts/body.woff2");
  });
});

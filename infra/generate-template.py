"""Generate the single CloudFormation template using standard JSON only."""
import json
from pathlib import Path

ref = lambda name: {"Ref": name}
sub = lambda text: {"Fn::Sub": text}
att = lambda name, key: {"Fn::GetAtt": [name, key]}
resource = lambda kind, props, **extra: {"Type": kind, "Properties": props, **extra}
tags = [{"Key": "Project", "Value": "RevenueRescue"}]
r = {}
r["UsageTable"] = resource("AWS::DynamoDB::Table", {
    "BillingMode": "PAY_PER_REQUEST", "AttributeDefinitions": [{"AttributeName": "PK", "AttributeType": "S"}],
    "KeySchema": [{"AttributeName": "PK", "KeyType": "HASH"}],
    "TimeToLiveSpecification": {"AttributeName": "expiresAt", "Enabled": True}, "Tags": tags,
}, DeletionPolicy="Retain", UpdateReplacePolicy="Retain")
r["RuntimeRole"] = resource("AWS::IAM::Role", {
    "AssumeRolePolicyDocument": {"Version": "2012-10-17", "Statement": [{"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]},
    "Policies": [{"PolicyName": "GuestAgentRuntime", "PolicyDocument": {"Version": "2012-10-17", "Statement": [
        {"Effect": "Allow", "Action": "bedrock:InvokeModel", "Resource": sub("arn:${AWS::Partition}:bedrock:${AWS::Region}::foundation-model/amazon.nova-lite-v1:0")},
        {"Effect": "Allow", "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:ConditionCheckItem"], "Resource": att("UsageTable", "Arn")},
        {"Effect": "Allow", "Action": ["logs:CreateLogStream", "logs:PutLogEvents"], "Resource": sub("arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}-agent:*")},
    ]}}], "Tags": tags,
})
r["AgentLogs"] = resource("AWS::Logs::LogGroup", {"LogGroupName": sub("/aws/lambda/${AWS::StackName}-agent"), "RetentionInDays": 3, "Tags": tags})
r["AgentFunction"] = resource("AWS::Lambda::Function", {
    "FunctionName": sub("${AWS::StackName}-agent"), "Runtime": "nodejs22.x", "Handler": "index.handler",
    "Role": att("RuntimeRole", "Arn"), "Timeout": 25, "MemorySize": 512,
    "Code": {"ZipFile": 'exports.handler=async()=>({statusCode:503,headers:{"content-type":"application/json","cache-control":"no-store"},body:JSON.stringify({error:{code:"DEPLOYING",message:"The online assistant is being deployed."}})});'},
    "Environment": {"Variables": {"TABLE_NAME": ref("UsageTable"), "MODEL_ID": "amazon.nova-lite-v1:0", "ORIGIN_SECRET": ref("OriginSecret"), "ALLOWED_ORIGINS": ref("AllowedOrigins"), "AGENT_ENABLED": ref("AgentEnabled")}},
    "Tags": tags,
}, DependsOn="AgentLogs")
r["HttpApi"] = resource("AWS::ApiGatewayV2::Api", {"Name": sub("${AWS::StackName}-api"), "ProtocolType": "HTTP", "Tags": {"Project": "RevenueRescue"}})
r["Integration"] = resource("AWS::ApiGatewayV2::Integration", {"ApiId": ref("HttpApi"), "IntegrationType": "AWS_PROXY", "IntegrationUri": att("AgentFunction", "Arn"), "PayloadFormatVersion": "2.0", "TimeoutInMillis": 28000})
for name in ["session", "analyze", "status"]:
    r[name.title()+"Route"] = resource("AWS::ApiGatewayV2::Route", {"ApiId": ref("HttpApi"), "RouteKey": "POST /api/"+name, "Target": {"Fn::Join": ["/", ["integrations", ref("Integration")]]}})
r["Stage"] = resource("AWS::ApiGatewayV2::Stage", {"ApiId": ref("HttpApi"), "StageName": "$default", "AutoDeploy": True, "DefaultRouteSettings": {"ThrottlingBurstLimit": 2, "ThrottlingRateLimit": 1}, "Tags": {"Project": "RevenueRescue"}})
r["InvokePermission"] = resource("AWS::Lambda::Permission", {"FunctionName": ref("AgentFunction"), "Action": "lambda:InvokeFunction", "Principal": "apigateway.amazonaws.com", "SourceArn": sub("arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${HttpApi}/*/POST/api/*")})
r["SiteBucket"] = resource("AWS::S3::Bucket", {"PublicAccessBlockConfiguration": {"BlockPublicAcls": True, "BlockPublicPolicy": True, "IgnorePublicAcls": True, "RestrictPublicBuckets": True}, "BucketEncryption": {"ServerSideEncryptionConfiguration": [{"ServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}, "OwnershipControls": {"Rules": [{"ObjectOwnership": "BucketOwnerEnforced"}]}, "Tags": tags}, DeletionPolicy="Retain", UpdateReplacePolicy="Retain")
r["SiteOAC"] = resource("AWS::CloudFront::OriginAccessControl", {"OriginAccessControlConfig": {"Name": sub("${AWS::StackName}-s3"), "OriginAccessControlOriginType": "s3", "SigningBehavior": "always", "SigningProtocol": "sigv4"}})
r["StaticRewrite"] = resource("AWS::CloudFront::Function", {"Name": sub("${AWS::StackName}-pages"), "AutoPublish": True, "FunctionConfig": {"Comment": "Map exported page routes to HTML without changing API requests", "Runtime": "cloudfront-js-2.0"}, "FunctionCode": 'function handler(event){var r=event.request;var u=r.uri;if(u==="/")r.uri="/index.html";else if(u.endsWith("/"))r.uri=u.slice(0,-1)+".html";else if(!u.split("/").pop().includes("."))r.uri=u+".html";return r;}'} )
r["HeadersPolicy"] = resource("AWS::CloudFront::ResponseHeadersPolicy", {"ResponseHeadersPolicyConfig": {"Name": sub("${AWS::StackName}-headers"), "SecurityHeadersConfig": {"ContentTypeOptions": {"Override": True}, "FrameOptions": {"FrameOption": "DENY", "Override": True}, "ReferrerPolicy": {"ReferrerPolicy": "strict-origin-when-cross-origin", "Override": True}, "StrictTransportSecurity": {"AccessControlMaxAgeSec": 15552000, "Override": True}}}})
r["Distribution"] = resource("AWS::CloudFront::Distribution", {"DistributionConfig": {
    "Enabled": True, "Comment": "RevenueRescue public guest application", "DefaultRootObject": "index.html", "HttpVersion": "http2and3", "IPV6Enabled": True, "PriceClass": "PriceClass_100",
    "Aliases": {"Fn::If": ["HasCertificate", [ref("DomainName")], ref("AWS::NoValue")]},
    "ViewerCertificate": {"Fn::If": ["HasCertificate", {"AcmCertificateArn": ref("CertificateArn"), "SslSupportMethod": "sni-only", "MinimumProtocolVersion": "TLSv1.2_2021"}, {"CloudFrontDefaultCertificate": True}]},
    "Origins": [
        {"Id": "StaticSite", "DomainName": att("SiteBucket", "RegionalDomainName"), "S3OriginConfig": {"OriginAccessIdentity": ""}, "OriginAccessControlId": ref("SiteOAC")},
        {"Id": "AgentAPI", "DomainName": sub("${HttpApi}.execute-api.${AWS::Region}.amazonaws.com"), "CustomOriginConfig": {"OriginProtocolPolicy": "https-only", "OriginSSLProtocols": ["TLSv1.2"], "OriginReadTimeout": 30, "OriginKeepaliveTimeout": 5}, "OriginCustomHeaders": [{"HeaderName": "x-origin-verify", "HeaderValue": ref("OriginSecret")} ]},
    ],
    "DefaultCacheBehavior": {"TargetOriginId": "StaticSite", "ViewerProtocolPolicy": "redirect-to-https", "AllowedMethods": ["GET", "HEAD"], "Compress": True, "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6", "ResponseHeadersPolicyId": ref("HeadersPolicy"), "FunctionAssociations": [{"EventType": "viewer-request", "FunctionARN": att("StaticRewrite", "FunctionARN")}]},
    "CacheBehaviors": [{"PathPattern": "/api/*", "TargetOriginId": "AgentAPI", "ViewerProtocolPolicy": "https-only", "AllowedMethods": ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"], "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac", "ResponseHeadersPolicyId": ref("HeadersPolicy"), "Compress": False}],
}, "Tags": tags})
r["BucketPolicy"] = resource("AWS::S3::BucketPolicy", {"Bucket": ref("SiteBucket"), "PolicyDocument": {"Version": "2012-10-17", "Statement": [{"Effect": "Allow", "Principal": {"Service": "cloudfront.amazonaws.com"}, "Action": "s3:GetObject", "Resource": sub("${SiteBucket.Arn}/*"), "Condition": {"StringEquals": {"AWS:SourceArn": sub("arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${Distribution}")}}}]}})
template = {
    "AWSTemplateFormatVersion": "2010-09-09", "Description": "RevenueRescue bounded public AWS guest demo",
    "Parameters": {
        "OriginSecret": {"Type": "String", "NoEcho": True, "MinLength": 32},
        "AllowedOrigins": {"Type": "String", "Default": "https://rescue.kanexi.me"},
        "AgentEnabled": {"Type": "String", "Default": "false", "AllowedValues": ["true", "false"]},
        "DomainName": {"Type": "String", "Default": "rescue.kanexi.me"},
        "CertificateArn": {"Type": "String", "Default": ""},
    },
    "Conditions": {"HasCertificate": {"Fn::Not": [{"Fn::Equals": [ref("CertificateArn"), ""]}]}},
    "Resources": r,
    "Outputs": {"SiteBucket": {"Value": ref("SiteBucket")}, "DistributionId": {"Value": ref("Distribution")}, "SiteDomain": {"Value": att("Distribution", "DomainName")}, "FunctionName": {"Value": ref("AgentFunction")}, "TableName": {"Value": ref("UsageTable")}, "ApiOrigin": {"Value": sub("https://${HttpApi}.execute-api.${AWS::Region}.amazonaws.com")}},
}
Path(__file__).with_name("aws.json").write_text(json.dumps(template, indent=2)+"\n")

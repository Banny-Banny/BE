// EC2 Launch Template 조회 스크립트 (AWS SDK v3)
// 사용법:
//   1) 의존성 설치: npm i @aws-sdk/client-ec2
//   2) 환경변수 설정:
//        AWS_REGION=ap-northeast-2
//        AWS_ACCESS_KEY_ID=...
//        AWS_SECRET_ACCESS_KEY=...
//      (또는 ~/.aws/credentials, AWS_PROFILE 사용)
//   3) 실행: node scripts/describe-launch-template.js

const {
  EC2Client,
  DescribeLaunchTemplateVersionsCommand,
} = require('@aws-sdk/client-ec2');

async function main() {
  // 필요한 값만 변경해서 사용하세요.
  const launchTemplateId = 'lt-0541edc2add42dfc7';
  const versions = ['1'];

  const ec2 = new EC2Client({
    region: process.env.AWS_REGION || 'ap-northeast-2',
  });

  const input = {
    LaunchTemplateId: launchTemplateId,
    Versions: versions,
  };

  const command = new DescribeLaunchTemplateVersionsCommand(input);
  const response = await ec2.send(command);

  console.log(JSON.stringify(response, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

const browser = process.argv[2];
if (!browser) {
  console.error("Browser argument is missing.");
  process.exit(1);
}

const BUCKET_NAME = "better-lyrics-sourcemaps";
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (!R2_ENDPOINT || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error("Missing required environment variables for R2 upload.");
  process.exit(1);
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const version = packageJson.version;

async function uploadFile(filePath: string) {
  const fileName = path.basename(filePath);
  const fileStream = fs.createReadStream(filePath);

  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: `${browser}/v${version}/${fileName}`,
    Body: fileStream,
    ContentType: "application/json",
  };

  try {
    const _data = await s3Client.send(new PutObjectCommand(uploadParams));
    console.log(`Successfully uploaded ${fileName} to R2.`);
  } catch (err) {
    console.error(`Error uploading ${fileName}:`, err);
    process.exit(1);
  }
}

function findFiles(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
}

const sourcemapFiles = findFiles(`./sourcemaps_for_upload/${browser}`);

Promise.all(sourcemapFiles.map(uploadFile));

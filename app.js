import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { json, urlencoded } from "express";
import multer from "multer";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const app = express();
// We create a multer instance with storage to store in memory and then into s3
const memoryStorage = multer.memoryStorage();
const multerInstance = multer({ storage: memoryStorage });
// We are only accepting one file in this example
const multerMiddleware = multerInstance.single("file");

const s3BucketName = process.env.S3_BUCKET_NAME;
const s3Region = process.env.S3_REGION;
const s3AccessKey = process.env.S3_ACCESS_KEY;
const s3SecretKey = process.env.S3_SECRET_KEY;

const client = new S3Client({
    credentials: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
    },
    region: s3Region,
});

app.use(json());
app.use(urlencoded({ extended: true }));

app.post("/", multerMiddleware, async (req, res) => {
    // Random id for file to be stored
    const randomFileName = crypto.randomBytes(32).toString("hex");

    const params = {
        Bucket: s3BucketName,
        // File name you want to save as in S3 bucket, in this case we are using a random generated name. Be sure to make it unique
        Key: randomFileName,
        // The file body itself
        Body: req.file.buffer,
        // The file typ
        ContentType: req.file.mimetype,
    };

    const uploadFileCommand = new PutObjectCommand(params);
    await client.send(uploadFileCommand); // Telling the amazon s3 client to send our upload command

    // !NOTE: Here you would save your image and metadata into a database
    // const savedFile = files.save({
    //     name: req.file.originalname,
    //     type: req.file.mimetype,
    //     fileName: randomFileName,
    //     size: req.file.size,
    // });

    res.status(201).json({ success: true });
});

app.get("/:fileId", async (req, res) => {
    // !NOTE: Your ID should be the database id, here you would access database and make sure it exists
    // ! We are just accessing it directly because we dont have a database this is just an example
    const fileId = req.params.fileId;

    const params = {
        Bucket: s3BucketName,
        Key: fileId, // This you would need to get it from your database
    };

    const getFileCommand = new GetObjectCommand(params); // Get the object
    const signedUrl = await getSignedUrl(client, getFileCommand, {
        expiresIn: 3600,
    }); // Generate a url to get the file that provides temporary access to it
    // The policies block access however this function gives us a url that we can use to share it for 3600 seconds
    // By doing it like this, we can make sure to do authorization before generating a url and make urls that have way less life in seconds

    res.status(200).json({ success: true, data: { fileUrl: signedUrl } });
});

app.delete("/:fileId", async (req, res) => {
    // !NOTE: Your ID should be the database id, here you would access database and make sure it exists
    // ! We are just accessing it directly because we dont have a database this is just an example
    const fileId = req.params.fileId;

    const params = {
        Bucket: s3BucketName,
        Key: fileId, // This you would need to get it from your database
    };

    // Delete it from s3
    try {
        const deleteCommand = new DeleteObjectCommand(params);
        await client.send(deleteCommand);
    } catch (error) {
        console.log("Error deleting file", error);
    }

    // Delete it from database once you deleted it from s3
    // !NOTE: Here you would delete it from database

    res.status(200).json({ success: true });
});

try {
    app.listen(5000, () => console.log("listening"));
} catch (error) {
    console.log("Error on starting server: " + error);
}

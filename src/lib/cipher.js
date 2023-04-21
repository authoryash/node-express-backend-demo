const crypto = require("crypto");
const { ENCRYPTION_KEY, ENCRYPTION_IV } = process.env;
const encryptionAlgo = "AES-256-CBC";
const encryptionKey = crypto
  .createHash("sha512")
  .update(ENCRYPTION_KEY, "utf-8")
  .digest("hex")
  .substring(0, 32);
const encryptionIV = crypto
  .createHash("sha512")
  .update(ENCRYPTION_IV, "utf-8")
  .digest("hex")
  .substring(0, 16);

function encryption(message) {
  const encryptor = crypto.createCipheriv(
    encryptionAlgo,
    encryptionKey,
    encryptionIV
  );
  const encryptionMessage = `${encryptor.update(
    message,
    "utf8",
    "base64"
  )}${encryptor.final("base64")}`;
  return Buffer.from(encryptionMessage).toString("base64");
}

function decryption(encryptedValue) {
  const buff = Buffer.from(encryptedValue, "base64");
  const encryVal = buff.toString("utf-8");
  const decryptor = crypto.createDecipheriv(
    encryptionAlgo,
    encryptionKey,
    encryptionIV
  );
  return `${decryptor.update(encryVal, "base64", "utf8")}${decryptor.final(
    "utf8"
  )}`;
}

module.exports = {
  encryption,
  decryption,
};

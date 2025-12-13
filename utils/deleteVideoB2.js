// utils/b2.js
import axios from "axios";

const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY;
const B2_BUCKET_ID = process.env.B2_BUCKET_ID;

const B2_API_BASE = "https://api.backblazeb2.com";

let b2Auth = null;

// Get or cache B2 auth (apiUrl + token)
const ensureB2Auth = async () => {
  if (b2Auth) return b2Auth;

  const basic = Buffer.from(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`).toString("base64");

  const res = await axios.get(`${B2_API_BASE}/b2api/v2/b2_authorize_account`, {
    headers: {
      Authorization: `Basic ${basic}`,
    },
  });

  b2Auth = {
    apiUrl: res.data.apiUrl,
    authorizationToken: res.data.authorizationToken,
  };
  return b2Auth;
};


export const deleteFromB2 = async (fileName) => {
  if (!fileName) return;

  try {
    const { apiUrl, authorizationToken } = await ensureB2Auth();


    const listRes = await axios.post(
      `${apiUrl}/b2api/v2/b2_list_file_versions`,
      {
        bucketId: B2_BUCKET_ID,
        prefix: fileName,
        maxFileCount: 100,
      },
      {
        headers: {
          Authorization: authorizationToken,
        },
      }
    );

    const file = (listRes.data.files || []).find(
      (f) => f.fileName === fileName
    );

    if (!file) {
      console.warn(`B2 delete: file not found by name: ${fileName}`);
      return;
    }


    await axios.post(
      `${apiUrl}/b2api/v2/b2_delete_file_version`,
      {
        fileName: file.fileName,
        fileId: file.fileId,
      },
      {
        headers: {
          Authorization: authorizationToken,
        },
      }
    );

    // console.log(`🧹 Deleted from B2: ${fileName}`);
  } catch (err) {
    console.warn(
      `B2 delete failed for ${fileName}:`,
      err.response?.status || err.message
    );
  }
};

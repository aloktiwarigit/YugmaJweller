import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
import type { StoragePort } from '../storage.port';

const SAS_TTL_MINUTES_UPLOAD = 60;     // 1 hour for upload SAS (one-shot)
const SAS_TTL_MINUTES_READ   = 60;     // 1 hour for read SAS (used by reconciliation only)

/**
 * Production adapter against Azure Blob Storage (Central or South India per ADR-0015).
 * Originals are stored privately; ImageKit Web Folder fetches them server-side
 * with read-only credentials configured in the ImageKit dashboard.
 *
 * Selected when STORAGE_ADAPTER=azure-imagekit. STUB is the default for dev/CI.
 */
export class AzureBlobAdapter implements StoragePort {
  private readonly accountName: string;
  private readonly containerName: string;
  private readonly credential: StorageSharedKeyCredential;
  private readonly serviceClient: BlobServiceClient;

  constructor() {
    this.accountName   = required('AZURE_STORAGE_ACCOUNT');
    this.containerName = required('AZURE_STORAGE_CONTAINER');
    const accountKey   = required('AZURE_STORAGE_ACCOUNT_KEY');
    this.credential = new StorageSharedKeyCredential(this.accountName, accountKey);
    this.serviceClient = new BlobServiceClient(
      `https://${this.accountName}.blob.core.windows.net`,
      this.credential,
    );
  }

  async getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse('cw'),
        startsOn: new Date(Date.now() - 60_000),                                // 1-min skew
        expiresOn: new Date(Date.now() + SAS_TTL_MINUTES_UPLOAD * 60_000),
        contentType,
      },
      this.credential,
    ).toString();
    return `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${key}?${sas}`;
  }

  async getPublicUrl(key: string): Promise<string> {
    // Public URL goes through ImageKit Web Folder, NOT Azure directly.
    // ImageKit fetches the private Azure blob using credentials configured
    // in the ImageKit dashboard. Customers never receive Azure URLs.
    const imagekitId = required('IMAGEKIT_ID');
    return `https://ik.imagekit.io/${imagekitId}/${key}`;
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const blob = this.serviceClient.getContainerClient(this.containerName).getBlockBlobClient(key);
    return await blob.downloadToBuffer();
  }

  async uploadBuffer(key: string, data: Buffer, contentType: string): Promise<void> {
    const blob = this.serviceClient.getContainerClient(this.containerName).getBlockBlobClient(key);
    await blob.uploadData(data, { blobHTTPHeaders: { blobContentType: contentType } });
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(Date.now() - 60_000),
        expiresOn: new Date(Date.now() + SAS_TTL_MINUTES_READ * 60_000),
      },
      this.credential,
    ).toString();
    return `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${key}?${sas}`;
  }

  async deleteBlob(key: string): Promise<void> {
    const blob = this.serviceClient.getContainerClient(this.containerName).getBlockBlobClient(key);
    try {
      await blob.delete();
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status !== 404) throw err;     // 404 = already deleted; lenient
    }
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`AzureBlobAdapter requires env var ${name}`);
  return v;
}

import { Injectable } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { GetConfigResponse } from '../models/api.models';

interface ZimraDeviceCertificate {
  deviceID: number;
  deviceSerialNo: string;
  certificatePem: string;
  validFrom: string; // ISO
  validTill: string; // ISO
}

interface ZimraDbSchema extends DBSchema {
  deviceCertificates: {
    key: number;
    value: ZimraDeviceCertificate;
  };
  deviceConfigs: {
    key: number;
    value: {
      deviceID: number;
      config: GetConfigResponse;
      syncedAt: string;
    };
  };
}

const DB_NAME = 'zimra-fdms';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class StorageService {
  private dbPromise: Promise<IDBPDatabase<ZimraDbSchema>> | null = null;

  private async db(): Promise<IDBPDatabase<ZimraDbSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<ZimraDbSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('deviceCertificates')) {
            db.createObjectStore('deviceCertificates', { keyPath: 'deviceID' });
          }
          if (!db.objectStoreNames.contains('deviceConfigs')) {
            db.createObjectStore('deviceConfigs', { keyPath: 'deviceID' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  async saveDeviceCertificate(input: ZimraDeviceCertificate): Promise<void> {
    const database = await this.db();
    await database.put('deviceCertificates', input);
  }

  async getDeviceCertificate(deviceID: number): Promise<ZimraDeviceCertificate | undefined> {
    const database = await this.db();
    return database.get('deviceCertificates', deviceID);
  }

  async getAnyDeviceCertificate(): Promise<ZimraDeviceCertificate | undefined> {
    const database = await this.db();
    const keys = await database.getAllKeys('deviceCertificates');
    if (keys.length === 0) return undefined;
    // Pick the certificate with the latest `validTill` to better match
    // "Device Already Registered" semantics when multiple certificates exist.
    const certs = await Promise.all(
      keys.map((k) => database.get('deviceCertificates', k as number))
    );
    const validCerts = certs.filter((c): c is ZimraDeviceCertificate => Boolean(c));
    validCerts.sort((a, b) => new Date(b.validTill).getTime() - new Date(a.validTill).getTime());
    return validCerts[0];
  }

  async listDeviceCertificates(): Promise<ZimraDeviceCertificate[]> {
    const database = await this.db();
    const all = await database.getAll('deviceCertificates');
    return all.sort((a, b) => (a.validTill < b.validTill ? 1 : -1));
  }

  async saveDeviceConfig(deviceID: number, config: GetConfigResponse): Promise<void> {
    const database = await this.db();
    await database.put('deviceConfigs', {
      deviceID,
      config,
      syncedAt: new Date().toISOString(),
    });
  }

  async getDeviceConfig(deviceID: number): Promise<GetConfigResponse | undefined> {
    const database = await this.db();
    const row = await database.get('deviceConfigs', deviceID);
    return row?.config;
  }

  async getAnyDeviceConfig(): Promise<GetConfigResponse | undefined> {
    const database = await this.db();
    const rows = await database.getAll('deviceConfigs');
    if (rows.length === 0) return undefined;
    rows.sort((a, b) => (a.syncedAt < b.syncedAt ? 1 : -1));
    return rows[0]?.config;
  }
}


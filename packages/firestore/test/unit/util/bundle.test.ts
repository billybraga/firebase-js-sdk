/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { expect } from 'chai';
import { Bundle } from '../../../src/util/bundle';
import { isNode } from '../../util/test_platform';

/**
 * Create a `ReadableStream` from a underlying buffer.
 *
 * @param data: Underlying buffer.
 * @param bytesPerRead: How many bytes to read from the underlying buffer from each read through the stream.
 */
function readableStreamFromString(
  content: string,
  bytesPerRead: number
): ReadableStream<Uint8Array | ArrayBuffer> {
  const data = new TextEncoder().encode(content);
  let readFrom = 0;
  return new ReadableStream({
    start(controller) {},
    async pull(controller): Promise<void> {
      controller.enqueue(data.slice(readFrom, readFrom + bytesPerRead));
      readFrom += bytesPerRead;
      if (readFrom >= data.byteLength) {
        controller.close();
      }
    }
  });
}

// eslint-disable-next-line no-restricted-properties
(isNode() ? describe.skip : describe)('readableStreamFromString()', () => {
  it('returns stepping readable stream', async () => {
    const encoder = new TextEncoder();
    const s = readableStreamFromString('0123456789', 4);
    const r = s.getReader();

    let result = await r.read();
    expect(result.value).to.deep.equal(encoder.encode('0123'));
    expect(result.done).to.be.false;

    result = await r.read();
    expect(result.value).to.deep.equal(encoder.encode('4567'));
    expect(result.done).to.be.false;

    result = await r.read();
    expect(result.value).to.deep.equal(encoder.encode('89'));
    expect(result.done).to.be.false;

    result = await r.read();
    expect(result.value).to.be.undefined;
    expect(result.done).to.be.true;
  });
});

describe('Bundle ', () => {
  if (!isNode()) {
    genericBundleReadingTests(1);
    genericBundleReadingTests(4);
    genericBundleReadingTests(64);
    genericBundleReadingTests(1024);
  }
  genericBundleReadingTests(0);
});

function genericBundleReadingTests(bytesPerRead: number): void {
  const encoder = new TextEncoder();

  function testTextSuffix(): string {
    if (bytesPerRead > 0) {
      return ` from ReadableStream with bytesPerRead: ${bytesPerRead}`;
    }
    return ' from Uint8Array';
  }

  function bundleFromString(s: string): Bundle {
    if (bytesPerRead > 0) {
      return new Bundle(readableStreamFromString(s, bytesPerRead));
    }
    return new Bundle(encoder.encode(s));
  }

  function lengthPrefixedString(o: {}): string {
    const str = JSON.stringify(o);
    const l = new TextEncoder().encode(str).byteLength;
    return `${l}${str}`;
  }

  // Setting up test data.
  const meta = {
    metadata: {
      id: 'test-bundle',
      createTime: { seconds: 1577836805, nanos: 6 },
      version: 1,
      totalDocuments: 1,
      totalBytes: 416
    }
  };
  const metaString = lengthPrefixedString(meta);

  const doc1Meta = {
    documentMetadata: {
      name:
        'projects/test-project/databases/(default)/documents/collectionId/doc1',
      readTime: { seconds: 5, nanos: 6 },
      exists: true
    }
  };
  const doc1MetaString = lengthPrefixedString(doc1Meta);
  const doc1 = {
    document: {
      name:
        'projects/test-project/databases/(default)/documents/collectionId/doc1',
      createTime: { _seconds: 1, _nanoseconds: 2000000 },
      updateTime: { _seconds: 3, _nanoseconds: 4000 },
      fields: { foo: { stringValue: 'value' }, bar: { integerValue: -42 } }
    }
  };
  const doc1String = lengthPrefixedString(doc1);

  const doc2Meta = {
    documentMetadata: {
      name:
        'projects/test-project/databases/(default)/documents/collectionId/doc2',
      readTime: { seconds: 5, nanos: 6 },
      exists: true
    }
  };
  const doc2MetaString = lengthPrefixedString(doc2Meta);
  const doc2 = {
    document: {
      name:
        'projects/test-project/databases/(default)/documents/collectionId/doc2',
      createTime: { _seconds: 1, _nanoseconds: 2000000 },
      updateTime: { _seconds: 3, _nanoseconds: 4000 },
      fields: { foo: { stringValue: 'value1' }, bar: { integerValue: 42 } }
    }
  };
  const doc2String = lengthPrefixedString(doc2);

  const noDocMeta = {
    documentMetadata: {
      name:
        'projects/test-project/databases/(default)/documents/collectionId/nodoc',
      readTime: { seconds: 5, nanos: 6 },
      exists: false
    }
  };
  const noDocMetaString = lengthPrefixedString(noDocMeta);

  const limitQuery = {
    namedQuery: {
      name: 'limitQuery',
      bundledQuery: {
        parent: 'projects/fireeats-97d5e/databases/(default)/documents',
        structuredQuery: {
          from: [{ collectionId: 'node_3.7.5_7Li7XoCjutvNxwD0tpo9' }],
          orderBy: [{ field: { fieldPath: 'sort' }, direction: 'DESCENDING' }],
          limit: { 'value': 1 }
        },
        limitType: 'FIRST'
      },
      readTime: { 'seconds': 1590011379, 'nanos': 191164000 }
    }
  };
  const limitQueryString = lengthPrefixedString(limitQuery);
  const limitToLastQuery = {
    namedQuery: {
      name: 'limitToLastQuery',
      bundledQuery: {
        parent: 'projects/fireeats-97d5e/databases/(default)/documents',
        structuredQuery: {
          from: [{ collectionId: 'node_3.7.5_7Li7XoCjutvNxwD0tpo9' }],
          orderBy: [{ field: { fieldPath: 'sort' }, direction: 'ASCENDING' }],
          limit: { 'value': 1 }
        },
        limitType: 'LAST'
      },
      readTime: { 'seconds': 1590011379, 'nanos': 543063000 }
    }
  };
  const limitToLastQueryString = lengthPrefixedString(limitToLastQuery);

  async function expectErrorFromBundle(
    bundleString: string,
    bytesPerRead: number,
    validMeta = false
  ): Promise<void> {
    const bundle = bundleFromString(bundleString);

    if (!validMeta) {
      await expect(await bundle.getMetadata()).should.be.rejected;
    } else {
      expect(await bundle.getMetadata()).to.deep.equal(meta.metadata);
    }

    const actual = [];
    for await (const sizedElement of bundle.elements()) {
      actual.push(sizedElement);
    }
  }

  it('reads with query and doc' + testTextSuffix(), async () => {
    const bundle = bundleFromString(
      metaString +
        limitQueryString +
        limitToLastQueryString +
        doc1MetaString +
        doc1String
    );

    expect(await bundle.getMetadata()).to.deep.equal(meta.metadata);

    const actual = [];
    for await (const sizedElement of bundle.elements()) {
      actual.push(sizedElement);
    }
    expect(actual.length).to.equal(4);
    expect(actual[0]).to.deep.equal({
      payload: limitQuery,
      byteLength: encoder.encode(limitQueryString).byteLength
    });
    expect(actual[1]).to.deep.equal({
      payload: limitToLastQuery,
      byteLength: encoder.encode(limitToLastQueryString).byteLength
    });
    expect(actual[2]).to.deep.equal({
      payload: doc1Meta,
      byteLength: encoder.encode(doc1MetaString).byteLength
    });
    expect(actual[3]).to.deep.equal({
      payload: doc1,
      byteLength: encoder.encode(doc1String).byteLength
    });
  });

  it('reads with unexpected orders' + testTextSuffix(), async () => {
    const bundle = bundleFromString(
      metaString +
        doc1MetaString +
        doc1String +
        limitQueryString +
        doc2MetaString +
        doc2String
    );

    const actual = [];
    for await (const sizedElement of bundle.elements()) {
      actual.push(sizedElement);
    }
    expect(actual.length).to.equal(5);
    expect(actual[0]).to.deep.equal({
      payload: doc1Meta,
      byteLength: encoder.encode(doc1MetaString).byteLength
    });
    expect(actual[1]).to.deep.equal({
      payload: doc1,
      byteLength: encoder.encode(doc1String).byteLength
    });
    expect(actual[2]).to.deep.equal({
      payload: limitQuery,
      byteLength: encoder.encode(limitQueryString).byteLength
    });
    expect(actual[3]).to.deep.equal({
      payload: doc2Meta,
      byteLength: encoder.encode(doc2MetaString).byteLength
    });
    expect(actual[4]).to.deep.equal({
      payload: doc2,
      byteLength: encoder.encode(doc2String).byteLength
    });

    // Reading metadata after other elements should also work.
    expect(await bundle.getMetadata()).to.deep.equal(meta.metadata);
  });

  it('reads without named query' + testTextSuffix(), async () => {
    const bundle = bundleFromString(metaString + doc1MetaString + doc1String);

    expect(await bundle.getMetadata()).to.deep.equal(meta.metadata);

    const actual = [];
    for await (const sizedElement of bundle.elements()) {
      actual.push(sizedElement);
    }
    expect(actual.length).to.equal(2);
    expect(actual[0]).to.deep.equal({
      payload: doc1Meta,
      byteLength: encoder.encode(doc1MetaString).byteLength
    });
    expect(actual[1]).to.deep.equal({
      payload: doc1,
      byteLength: encoder.encode(doc1String).byteLength
    });
  });

  it('reads with deleted doc' + testTextSuffix(), async () => {
    const bundle = bundleFromString(
      metaString + noDocMetaString + doc1MetaString + doc1String
    );

    expect(await bundle.getMetadata()).to.deep.equal(meta.metadata);

    const actual = [];
    for await (const sizedElement of bundle.elements()) {
      actual.push(sizedElement);
    }
    expect(actual.length).to.equal(3);
    expect(actual[0]).to.deep.equal({
      payload: noDocMeta,
      byteLength: encoder.encode(noDocMetaString).byteLength
    });
    expect(actual[1]).to.deep.equal({
      payload: doc1Meta,
      byteLength: encoder.encode(doc1MetaString).byteLength
    });
    expect(actual[2]).to.deep.equal({
      payload: doc1,
      byteLength: encoder.encode(doc1String).byteLength
    });
  });

  it('reads without documents or query' + testTextSuffix(), async () => {
    const bundle = bundleFromString(metaString);

    expect(await bundle.getMetadata()).to.deep.equal(meta.metadata);

    const actual = [];
    for await (const sizedElement of bundle.elements()) {
      actual.push(sizedElement);
    }
    expect(actual.length).to.equal(0);
  });

  it(
    'throws with ill-formatted bundle with bytesPerRead' + testTextSuffix(),
    async () => {
      await expect(
        expectErrorFromBundle('metadata: "no length prefix"', bytesPerRead)
      ).to.be.rejected;

      await expect(
        expectErrorFromBundle('{metadata: "no length prefix"}', bytesPerRead)
      ).to.be.rejected;

      await expect(
        expectErrorFromBundle(metaString + 'invalid-string', bytesPerRead, true)
      ).to.be.rejected;

      await expect(expectErrorFromBundle('1' + metaString, bytesPerRead)).to.be
        .rejected;
    }
  );
}

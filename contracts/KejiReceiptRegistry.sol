// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract KejiReceiptRegistry {
    struct ReceiptRecord {
        string receiptId;
        string requestId;
        string provider;
        string summary;
        uint256 anchoredAt;
    }

    mapping(bytes32 => ReceiptRecord) private records;

    event ReceiptAnchored(
        bytes32 indexed receiptHash,
        string receiptId,
        string requestId,
        string provider,
        string summary,
        uint256 anchoredAt
    );

    function anchorReceipt(
        bytes32 receiptHash,
        string calldata receiptId,
        string calldata requestId,
        string calldata provider,
        string calldata summary
    ) external {
        require(records[receiptHash].anchoredAt == 0, "receipt already anchored");

        ReceiptRecord memory record = ReceiptRecord({
            receiptId: receiptId,
            requestId: requestId,
            provider: provider,
            summary: summary,
            anchoredAt: block.timestamp
        });

        records[receiptHash] = record;

        emit ReceiptAnchored(
            receiptHash,
            receiptId,
            requestId,
            provider,
            summary,
            block.timestamp
        );
    }

    function getReceipt(bytes32 receiptHash) external view returns (ReceiptRecord memory) {
        require(records[receiptHash].anchoredAt != 0, "receipt not found");
        return records[receiptHash];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SignedSeal — Two-party signed receipts / proof of agreement
contract SignedSeal {
    enum State { Pending, Signed, Cancelled }

    struct Receipt {
        uint256 id;
        address party1;
        address party2;
        string title;
        string details;
        uint256 amount;   // optional USDC amount locked by party1
        bool party1Signed;
        bool party2Signed;
        State state;
        uint256 createdAt;
        uint256 signedAt;
    }

    Receipt[] public receipts;
    bool private locked;
    modifier noReentrant() { require(!locked); locked = true; _; locked = false; }

    event ReceiptCreated(uint256 indexed id, address indexed party1, address indexed party2, string title);
    event ReceiptSigned(uint256 indexed id, address indexed signer);
    event ReceiptFinalized(uint256 indexed id);
    event ReceiptCancelled(uint256 indexed id);

    function create(address party2, string calldata title, string calldata details) external payable returns (uint256) {
        require(party2 != address(0) && party2 != msg.sender, "Invalid party2");
        require(bytes(title).length > 0, "Title required");
        uint256 id = receipts.length;
        receipts.push(Receipt(id, msg.sender, party2, title, details, msg.value, true, false, State.Pending, block.timestamp, 0));
        emit ReceiptCreated(id, msg.sender, party2, title);
        emit ReceiptSigned(id, msg.sender);
        return id;
    }

    function sign(uint256 id) external noReentrant {
        require(id < receipts.length, "Not found");
        Receipt storage r = receipts[id];
        require(r.state == State.Pending, "Not pending");
        require(msg.sender == r.party2, "Not party2");
        require(!r.party2Signed, "Already signed");
        r.party2Signed = true;
        r.state = State.Signed;
        r.signedAt = block.timestamp;
        emit ReceiptSigned(id, msg.sender);
        emit ReceiptFinalized(id);
        // If party1 locked USDC, release to party2 on agreement
        if (r.amount > 0) {
            (bool ok,) = payable(r.party2).call{value: r.amount}("");
            require(ok, "Transfer failed");
        }
    }

    function cancel(uint256 id) external noReentrant {
        require(id < receipts.length, "Not found");
        Receipt storage r = receipts[id];
        require(r.state == State.Pending, "Not pending");
        require(msg.sender == r.party1, "Only party1");
        r.state = State.Cancelled;
        emit ReceiptCancelled(id);
        if (r.amount > 0) {
            (bool ok,) = payable(r.party1).call{value: r.amount}("");
            require(ok, "Refund failed");
        }
    }

    function getAll(uint256 count) external view returns (Receipt[] memory) {
        uint256 len = receipts.length;
        uint256 n = count > len ? len : count;
        Receipt[] memory result = new Receipt[](n);
        for (uint256 i = 0; i < n; i++) result[i] = receipts[len - 1 - i];
        return result;
    }

    function total() external view returns (uint256) { return receipts.length; }
    receive() external payable {}
}

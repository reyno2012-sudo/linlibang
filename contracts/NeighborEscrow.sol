// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NeighborEscrow is ReentrancyGuard {
    enum Status {
        Open,
        Accepted,
        Completed,
        Released,
        Cancelled,
        Disputed
    }

    struct Task {
        address payable requester;
        address payable helper;
        uint256 amount;
        Status status;
        uint64 createdAt;
        uint64 completedAt;
    }

    mapping(bytes32 taskId => Task task) public tasks;
    mapping(address helper => uint256 count) public completedTasks;

    event TaskCreated(bytes32 indexed taskId, address indexed requester, uint256 amount);
    event TaskAccepted(bytes32 indexed taskId, address indexed helper);
    event TaskCompleted(bytes32 indexed taskId, address indexed helper);
    event FundsReleased(bytes32 indexed taskId, address indexed helper, uint256 amount);
    event TaskCancelled(bytes32 indexed taskId);
    event TaskDisputed(bytes32 indexed taskId, address indexed raisedBy);

    function createTask(bytes32 taskId) external payable {
        require(taskId != bytes32(0), "Empty task id");
        require(msg.value > 0, "Escrow required");
        require(tasks[taskId].requester == address(0), "Task already exists");

        tasks[taskId] = Task({
            requester: payable(msg.sender),
            helper: payable(address(0)),
            amount: msg.value,
            status: Status.Open,
            createdAt: uint64(block.timestamp),
            completedAt: 0
        });
        emit TaskCreated(taskId, msg.sender, msg.value);
    }

    function acceptTask(bytes32 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == Status.Open && task.requester != address(0), "Task not open");
        require(msg.sender != task.requester, "Requester cannot accept");

        task.helper = payable(msg.sender);
        task.status = Status.Accepted;
        emit TaskAccepted(taskId, msg.sender);
    }

    function markCompleted(bytes32 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == Status.Accepted, "Task not accepted");
        require(msg.sender == task.helper, "Only helper");

        task.status = Status.Completed;
        task.completedAt = uint64(block.timestamp);
        emit TaskCompleted(taskId, msg.sender);
    }

    function approveAndRelease(bytes32 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == Status.Completed, "Task not completed");
        require(msg.sender == task.requester, "Only requester");

        task.status = Status.Released;
        completedTasks[task.helper] += 1;
        (bool sent, ) = task.helper.call{value: task.amount}("");
        require(sent, "Release failed");
        emit FundsReleased(taskId, task.helper, task.amount);
    }

    function cancelTask(bytes32 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == Status.Open && task.requester != address(0), "Task not open");
        require(msg.sender == task.requester, "Only requester");

        task.status = Status.Cancelled;
        (bool sent, ) = task.requester.call{value: task.amount}("");
        require(sent, "Refund failed");
        emit TaskCancelled(taskId);
    }

    function raiseDispute(bytes32 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == Status.Accepted || task.status == Status.Completed, "Cannot dispute");
        require(msg.sender == task.requester || msg.sender == task.helper, "Not a participant");

        task.status = Status.Disputed;
        emit TaskDisputed(taskId, msg.sender);
    }
}

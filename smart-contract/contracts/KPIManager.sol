// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title KPIManager
 * @dev Smart contract for managing Key Performance Indicators (KPIs)
 * with verifiable credential integration
 */
contract KPIManager is Ownable, ReentrancyGuard {
    struct KPIData {
        uint256 totalBaseline;
        uint256 totalSavings;
        uint256 entryCount;
        bool exists;
    }

    // Mapping from hash to KPI data
    mapping(string => KPIData) private kpiStorage;

    // Array to keep track of all hashes for enumeration
    string[] private allHashes;

    // Events
    event KPIsSet(
        string indexed hash,
        uint256 indexed baseline,
        uint256 indexed savings,
        uint256 newTotalBaseline,
        uint256 newTotalSavings,
        address sender,
        uint256 timestamp
    );

    event KPIsUpdated(
        string indexed hash,
        uint256 previousTotalBaseline,
        uint256 previousTotalSavings,
        uint256 newTotalBaseline,
        uint256 newTotalSavings,
        uint256 entryCount
    );

    /**
     * @dev Constructor sets the deployer as the initial owner
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @dev Set KPIs for a specific hash
     * Adds the baseline and savings to existing totals for that hash
     * @param hash The unique identifier for the KPI entry
     * @param baseline The baseline value to add
     * @param savings The savings value to add
     */
    function setKPIs(
        string memory hash,
        uint256 baseline,
        uint256 savings
    ) external nonReentrant {
        require(bytes(hash).length > 0, "Hash cannot be empty");
        require(
            baseline > 0 || savings > 0,
            "At least one value must be greater than 0"
        );

        KPIData storage kpiData = kpiStorage[hash];

        // Store previous values for event
        uint256 previousBaseline = kpiData.totalBaseline;
        uint256 previousSavings = kpiData.totalSavings;

        // If this is the first entry for this hash, add it to the array
        if (!kpiData.exists) {
            allHashes.push(hash);
            kpiData.exists = true;
        }

        // Add to existing totals
        kpiData.totalBaseline += baseline;
        kpiData.totalSavings += savings;
        kpiData.entryCount += 1;

        // Emit events
        emit KPIsSet(
            hash,
            baseline,
            savings,
            kpiData.totalBaseline,
            kpiData.totalSavings,
            msg.sender,
            block.timestamp
        );

        emit KPIsUpdated(
            hash,
            previousBaseline,
            previousSavings,
            kpiData.totalBaseline,
            kpiData.totalSavings,
            kpiData.entryCount
        );
    }

    /**
     * @dev Get total KPIs for a specific hash
     * @param hash The unique identifier to query
     * @return totalBaseline The total accumulated baseline for this hash
     * @return totalSavings The total accumulated savings for this hash
     * @return entryCount The number of times KPIs were set for this hash
     * @return exists Whether any KPIs exist for this hash
     */
    function getKPIs(
        string memory hash
    )
        external
        view
        returns (
            uint256 totalBaseline,
            uint256 totalSavings,
            uint256 entryCount,
            bool exists
        )
    {
        KPIData memory kpiData = kpiStorage[hash];
        return (
            kpiData.totalBaseline,
            kpiData.totalSavings,
            kpiData.entryCount,
            kpiData.exists
        );
    }

    /**
     * @dev Get all hashes that have KPI data
     * @return Array of all hashes with KPI entries
     */
    function getAllHashes() external view returns (string[] memory) {
        return allHashes;
    }

    /**
     * @dev Get the total number of unique hashes
     * @return The count of unique hashes with KPI data
     */
    function getHashCount() external view returns (uint256) {
        return allHashes.length;
    }

    /**
     * @dev Get KPI data for multiple hashes in a single call
     * @param hashes Array of hashes to query
     * @return baselines Array of total baselines for each hash
     * @return savings Array of total savings for each hash
     * @return entryCounts Array of entry counts for each hash
     * @return existsFlags Array of existence flags for each hash
     */
    function getBatchKPIs(
        string[] memory hashes
    )
        external
        view
        returns (
            uint256[] memory baselines,
            uint256[] memory savings,
            uint256[] memory entryCounts,
            bool[] memory existsFlags
        )
    {
        uint256 length = hashes.length;
        baselines = new uint256[](length);
        savings = new uint256[](length);
        entryCounts = new uint256[](length);
        existsFlags = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            KPIData memory kpiData = kpiStorage[hashes[i]];
            baselines[i] = kpiData.totalBaseline;
            savings[i] = kpiData.totalSavings;
            entryCounts[i] = kpiData.entryCount;
            existsFlags[i] = kpiData.exists;
        }
    }

    /**
     * @dev Check if KPI data exists for a hash
     * @param hash The hash to check
     * @return Whether KPI data exists for this hash
     */
    function hashExists(string memory hash) external view returns (bool) {
        return kpiStorage[hash].exists;
    }

    /**
     * @dev Get global statistics about all KPIs
     * @return totalUniqueHashes Number of unique hashes
     * @return globalBaseline Sum of all baselines across all hashes
     * @return globalSavings Sum of all savings across all hashes
     * @return totalEntries Total number of KPI entries across all hashes
     */
    function getGlobalStats()
        external
        view
        returns (
            uint256 totalUniqueHashes,
            uint256 globalBaseline,
            uint256 globalSavings,
            uint256 totalEntries
        )
    {
        totalUniqueHashes = allHashes.length;

        for (uint256 i = 0; i < allHashes.length; i++) {
            KPIData memory kpiData = kpiStorage[allHashes[i]];
            globalBaseline += kpiData.totalBaseline;
            globalSavings += kpiData.totalSavings;
            totalEntries += kpiData.entryCount;
        }
    }
}

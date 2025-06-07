// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0; 
pragma experimental ABIEncoderV2;

contract Election {
    struct Candidate {
        uint id;
        string name;
        string party;
        uint voteCount;
    }

    struct Voter {
        address voterAddress;
        string votedCandidate;
    }

    address public admin;
    uint public candidatesCount;
    mapping(uint => Candidate) public candidates;
    mapping(address => bool) public voters;
    Voter[] public electionDashboard;

    event votedEvent(uint indexed _candidateId, address indexed _voter, string _candidateName);

    constructor()  {
        admin = msg.sender;
        addCandidate("Candidate A", "Party 1");
        addCandidate("Candidate B", "Party 2");
        addCandidate("Candidate C", "Party 3");
        addCandidate("Candidate D", "Party 4");
        addCandidate("Candidate E", "Party 5");
        addCandidate("Candidate F", "Party 6");
    }

    function addCandidate(string memory _name, string memory _party) private {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, _party, 0);
    }

    function vote(uint _candidateId) public {
        require(!voters[msg.sender], "You have already voted.");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate.");

        voters[msg.sender] = true;
        candidates[_candidateId].voteCount++;

        // Store correct candidate name
        string memory candidateName = candidates[_candidateId].name;
        electionDashboard.push(Voter(msg.sender, candidateName));

        // Emit event with additional info
        emit votedEvent(_candidateId, msg.sender, candidateName);
    }

    function getElectionDashboard() public view returns (address[] memory, string[] memory) {
        uint totalVoters = electionDashboard.length;
        address[] memory voterAddresses = new address[](totalVoters);
        string[] memory votedCandidates = new string[](totalVoters);

        for (uint i = 0; i < totalVoters; i++) {
            voterAddresses[i] = electionDashboard[i].voterAddress;
            votedCandidates[i] = bytes(electionDashboard[i].votedCandidate).length == 0 
                                 ? "N/A" 
                                 : electionDashboard[i].votedCandidate;
        }

        return (voterAddresses, votedCandidates);
    }

    function getElectionResults() public view returns (string[] memory, string[] memory, uint[] memory) {
        require(msg.sender == admin, "Only the admin can view election results.");

        string[] memory candidateNames = new string[](candidatesCount);
        string[] memory candidateParties = new string[](candidatesCount);
        uint[] memory voteCounts = new uint[](candidatesCount);

        for (uint i = 1; i <= candidatesCount; i++) {
            candidateNames[i - 1] = candidates[i].name;
            candidateParties[i - 1] = candidates[i].party;
            voteCounts[i - 1] = candidates[i].voteCount;
        }

        return (candidateNames, candidateParties, voteCounts);
    }
}

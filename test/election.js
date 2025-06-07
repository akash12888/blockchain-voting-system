const Election = artifacts.require("./Election.sol");

contract("Election", function(accounts) {
  let electionInstance;
  const admin = accounts[0];
  const voter1 = accounts[1];
  const voter2 = accounts[2];
  const voter3 = accounts[3];
  const nonAdmin = accounts[4];

  beforeEach(async function() {
    electionInstance = await Election.new({ from: admin });
  });

  it("initializes with the correct number of candidates", async function() {
    const count = await electionInstance.candidatesCount();
    assert.equal(count, 6, "initializes with six candidates");
  });

  it("initializes the candidates with the correct values", async function() {
    for (let i = 1; i <= 6; i++) {
      const candidate = await electionInstance.candidates(i);
      assert.equal(candidate[0].toNumber(), i, `contains the correct id for candidate ${i}`);
      assert.equal(candidate[1], `Candidate ${String.fromCharCode(64 + i)}`, `contains the correct name for candidate ${i}`);
      assert.equal(candidate[2], `Party ${i}`, `contains the correct party for candidate ${i}`);
      assert.equal(candidate[3].toNumber(), 0, `contains the correct vote count for candidate ${i}`);
    }
  });

  it("allows a voter to cast a vote", async function() {
    const candidateId = 1;
    const receipt = await electionInstance.vote(candidateId, { from: voter1 });
    
    // Check vote count updated
    const candidate = await electionInstance.candidates(candidateId);
    assert.equal(candidate[3].toNumber(), 1, "increments the candidate's vote count");
    
    // Check voter is marked as having voted
    const hasVoted = await electionInstance.voters(voter1);
    assert.equal(hasVoted, true, "marks that voter has voted");
    
    // Check event was emitted correctly
    assert.equal(receipt.logs.length, 1, "an event was triggered");
    assert.equal(receipt.logs[0].event, "votedEvent", "the event type is correct");
    assert.equal(receipt.logs[0].args._candidateId.toNumber(), candidateId, "the candidate id is correct");
    assert.equal(receipt.logs[0].args._voter, voter1, "the voter address is correct");
    assert.equal(receipt.logs[0].args._candidateName, "Candidate A", "the candidate name is correct");
  });

  it("throws an exception for invalid candidates", async function() {
    try {
      await electionInstance.vote(99, { from: voter1 });
      assert.fail("should have thrown an error");
    } catch (error) {
      assert(error.message.includes("Invalid candidate"), "error message should contain 'Invalid candidate'");
    }
  });

  it("throws an exception for double voting", async function() {
    await electionInstance.vote(1, { from: voter1 });
    
    try {
      await electionInstance.vote(2, { from: voter1 });
      assert.fail("should have thrown an error");
    } catch (error) {
      assert(error.message.includes("You have already voted"), "error message should contain 'You have already voted'");
    }
  });

  it("allows admin to get election results", async function() {
    // Cast some votes
    await electionInstance.vote(1, { from: voter1 });
    await electionInstance.vote(2, { from: voter2 });
    await electionInstance.vote(1, { from: voter3 });
    
    const results = await electionInstance.getElectionResults({ from: admin });
    
    // Handle results as object-like structure
    assert.isObject(results, "results should be an object");
    
    // Ensure results has three properties (arrays)
    assert.property(results, '0', "should contain first array (candidateNames)");
    assert.property(results, '1', "should contain second array (candidateParties)");
    assert.property(results, '2', "should contain third array (voteCounts)");
    
    const candidateNames = results[0];
    const candidateParties = results[1];
    const voteCounts = results[2];
    
    // Check candidate names
    assert.equal(candidateNames[0], "Candidate A", "first candidate name is correct");
    assert.equal(candidateNames[1], "Candidate B", "second candidate name is correct");
    
    // Check vote counts
    assert.equal(voteCounts[0].toNumber(), 2, "Candidate A should have 2 votes");
    assert.equal(voteCounts[1].toNumber(), 1, "Candidate B should have 1 vote");
  });

  it("prevents non-admin from getting election results", async function() {
    try {
      await electionInstance.getElectionResults({ from: nonAdmin });
      assert.fail("should have thrown an error");
    } catch (error) {
      assert(error.message.includes("Only the admin can view election results"), "error message should contain 'Only the admin'");
    }
  });

  it("returns correct dashboard data", async function() {
    // Cast some votes
    await electionInstance.vote(1, { from: voter1 });
    await electionInstance.vote(2, { from: voter2 });
    
    const dashboard = await electionInstance.getElectionDashboard();
    
    // Handle dashboard as object-like structure
    assert.isObject(dashboard, "dashboard should be an object");
    
    // Ensure dashboard has two properties (arrays)
    assert.property(dashboard, '0', "should contain first array (voterAddresses)");
    assert.property(dashboard, '1', "should contain second array (votedCandidates)");
    
    const voterAddresses = dashboard[0];
    const votedCandidates = dashboard[1];
    
    // Check voter addresses
    assert.equal(voterAddresses.length, 2, "should have two voter addresses");
    assert.equal(voterAddresses[0], voter1, "first voter address is correct");
    assert.equal(voterAddresses[1], voter2, "second voter address is correct");
    
    // Check voted candidates
    assert.equal(votedCandidates.length, 2, "should have two voted candidates");
    assert.equal(votedCandidates[0], "Candidate A", "first voted candidate is correct");
    assert.equal(votedCandidates[1], "Candidate B", "second voted candidate is correct");
  });
});
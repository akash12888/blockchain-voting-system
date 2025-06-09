

var App = {
  
  web3Provider: null,           // Web3 provider (MetaMask)
  contracts: {},               // Smart contract instances
  account: '0x0',              // Current user's wallet address
  
  // Flags to prevent duplicate operations
  isVoting: false,             // Prevents multiple simultaneous votes
  submitInProgress: false,     // Prevents rapid form submissions
  dataProcessed: false,        // Prevents duplicate data processing
  resultsLoaded: false,        // Prevents duplicate results loading
  
  // Data storage
  voterData: [],              // List of voters and their votes
  candidateData: [],          // List of candidates and vote counts
  eventListener: null,        // Blockchain event listener

 
  init: function() {
    return App.initWeb3();
  },


  initWeb3: async function() {
    // Check if MetaMask is installed
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      web3 = new Web3(window.ethereum);

      try {
        // Request access to user's MetaMask accounts
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log("Connected to MetaMask");
      } catch (error) {
        console.error("Error requesting account access:", error);
        alert("Unable to connect to MetaMask.");
        return;
      }
    } else {
      // MetaMask not detected
      App.showMetaMaskError();
      return;
    }

    return App.initContract();
  },

  /**
   * Display MetaMask installation error
   */
  showMetaMaskError: function() {
    const errorMessage = `
      <div class="alert alert-danger text-center" role="alert">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <span>Please install MetaMask to use this application.</span>
      </div>
    `;
    
    if ($("#check-web3").length > 0) {
      $('#check-web3').html(errorMessage);
    } else {
      alert("No MetaMask detected. Please install MetaMask.");
    }
  },

  /**
   * Initialize smart contract connection
   */
  initContract: function() {
    $.getJSON("Election.json", function(election) {
      // Create contract instance using Truffle
      App.contracts.Election = TruffleContract(election);
      App.contracts.Election.setProvider(App.web3Provider);

      // Load initial data and set up event listeners
      App.loadVoterData();
      App.listenForEvents();
      App.listenForAccountChange();

      // Render the current page
      return App.render();
    });
  },

  // ========================================
  // DATA LOADING
  // ========================================

  /**
   * Load historical voting data from blockchain events
   */
  loadVoterData: async function() {
    try {
      const instance = await App.contracts.Election.deployed();
      
      // Get all past voting events
      const pastEvents = await instance.votedEvent({}, { 
        fromBlock: 0, 
        toBlock: 'latest' 
      });
      
      pastEvents.get(function(error, events) {
        if (error) {
          console.error(" Error fetching past events:", error);
          return;
        }
        
        // Reset voter data
        App.voterData = [];
        
        // Process each voting event
        events.forEach(function(event) {
          const voterAddress = event.args._voter;
          const candidateName = event.args._candidateName;
          
          // Only add if voter hasn't been recorded yet
          const exists = App.voterData.some(voter => voter.address === voterAddress);
          if (!exists) {
            App.voterData.push({
              address: voterAddress,
              candidateName: candidateName
            });
          }
        });
        
        // Update dashboard if we're on that page
        if ($("#dashboardPage").length > 0) {
          App.renderDashboard();
        }
      });
    } catch (error) {
      console.error("Error loading voter data:", error);
    }
  },

  // ========================================
  // EVENT LISTENERS
  // ========================================

  /**
   * Listen for new voting events on the blockchain
   */
  listenForEvents: async function() {
    try { 
      // Prevent duplicate event listeners
      if (App.eventListener) {
        return;
      }
      
      const instance = await App.contracts.Election.deployed();
      
      // Listen for new votes
      App.eventListener = instance.votedEvent({ fromBlock: 'latest' })
        .watch(function(error, event) {
          if (error) {
            console.error(" Error listening for event:", error);
            App.isVoting = false;
            App.render();
            return;
          }
          
          console.log(" New vote event:", event);
          App.handleNewVote(event);
        });
    } catch (error) {
      console.error(" Error setting up event listener:", error);
    }
  },

  /**
   * Handle a new vote event
   */
  handleNewVote: function(event) {
    const voterAddress = event.args._voter;
    const candidateName = event.args._candidateName;
    
    // Update voter data
    const existingVoterIndex = App.voterData.findIndex(voter => 
      voter.address === voterAddress
    );
    
    if (existingVoterIndex === -1) {
      // New voter
      App.voterData.push({
        address: voterAddress,
        candidateName: candidateName
      });
    } else {
      // Update existing voter (shouldn't happen in normal voting)
      App.voterData[existingVoterIndex].candidateName = candidateName;
    }

    // Update UI
    if ($("#dashboardPage").length > 0) {
      App.renderDashboard();
    }
    
    App.isVoting = false;
    App.render();
  },

  /**
   * Listen for MetaMask account changes
   */
  listenForAccountChange: function() {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', function(accounts) {
        if (accounts.length === 0) {
          console.log('🔒 MetaMask is locked or no accounts available');
          alert('Please unlock MetaMask and ensure accounts are available.');
          return;
        }

        App.account = accounts[0];
        console.log("🔄 Account changed to:", App.account);
        App.render();
      });
    }
  },

  // ========================================
  // RENDERING FUNCTIONS
  // ========================================

  /**
   * Main render function - determines which page to render
   */
  render: function() {
    const loader = $("#loader");
    const content = $("#content");

    // Show loading state
    loader.show();
    content.hide();

    // Don't render if voting is in progress
    if (App.isVoting) {
      return;
    }

    // Get current account and render appropriate page
    web3.eth.getAccounts(function(err, accounts) {
      if (err) {
        console.error("Error getting accounts:", err);
        loader.hide();
        content.show();
        return;
      }

      App.account = accounts[0];
      
      // Render based on current page
      if ($("#dashboardPage").length > 0) {
        App.renderDashboard();
      } else if ($("#resultsPage").length > 0) {
        App.loadElectionResults();
      } else if ($("#votingPage").length > 0 || $(".voting-container").length > 0) {
        App.renderVotingPage();
      } else {
        loader.hide();
        content.show();
      }
    });
  },
  
  /**
   * Render the voting dashboard (shows who voted for whom)
   */
  renderDashboard: function() {
    const loader = $("#loader");
    const content = $("#content");
  
    // Clear existing data
    $("#voterTable").empty();
    $("#no-votes").hide();
  
    // Prevent duplicate processing
    if (App.dataProcessed) {
      loader.hide();
      content.show();
      return;
    }
  
    // Add small delay to ensure data is loaded
    setTimeout(function() {
      App.dataProcessed = true;
      
      if (App.voterData.length === 0) {
        $("#no-votes").show();
      } else {
        $("#no-votes").hide();
        $("#voterTable").empty();
        
        // Populate voter table
        App.voterData.forEach(function(voter, index) {
          const row = `
            <tr>
              <td>${index + 1}</td>
              <td>${voter.address}</td>
              <td>${voter.candidateName}</td>
            </tr>
          `;
          $("#voterTable").append(row);
        });
      }
  
      loader.hide();
      content.show();
    }, 500);
  },

  /**
   * Render the voting page
   */
  renderVotingPage: function() {
    const loader = $("#loader");
    const content = $("#content");
    let electionInstance;
  
    // Display current account address
    if ($("#accountAddress").length > 0) {
      $("#accountAddress").html(`
        <span style="font-size:14px;">
          Your Voter's Address: 
          <span style="font-weight:600">${App.account}</span>
        </span><br><br>
      `);
    }
  
    // Load contract data
    App.contracts.Election.deployed()
      .then(function(instance) {
        electionInstance = instance;
        return electionInstance.candidatesCount();
      })
      .then(function(candidatesCount) {
        // Get all candidates and check if user has voted
        const candidatesPromises = [];
        for (let i = 1; i <= candidatesCount; i++) {
          candidatesPromises.push(electionInstance.candidates(i));
        }
        
        return Promise.all([
          Promise.all(candidatesPromises), 
          electionInstance.voters(App.account)
        ]);
      })
      .then(function(results) {
        const candidatesData = results[0];
        const hasVoted = results[1];
        
        App.populateCandidateData(candidatesData);
        App.handleVotingStatus(hasVoted);
        
        loader.hide();
        content.show();
      })
      .catch(function(error) {
        console.error(" Error rendering voting page:", error);
        loader.hide();
        content.show();
      });
  },

  /**
   * Populate candidate information in the UI
   */
  populateCandidateData: function(candidatesData) {
    // Populate results table
    if ($("#candidatesResults").length > 0) {
      const candidatesResults = $("#candidatesResults");
      candidatesResults.empty();
      
      candidatesData.forEach(function(candidate) {
        const [id, name, party] = candidate;
        const row = `<tr><th>${id}</th><td>${name}</td><td>${party}</td></tr>`;
        candidatesResults.append(row);
      });
    }
    
    // Populate dropdown
    if ($("#candidatesSelect").length > 0) {
      const candidatesSelect = $('#candidatesSelect');
      candidatesSelect.empty();
      
      candidatesData.forEach(function(candidate) {
        const [id, name, party] = candidate;
        const option = `<option value="${id}">${name} (${party})</option>`;
        candidatesSelect.append(option);
      });
    }
  },

  /**
   * Handle voting status (already voted or can vote)
   */
  handleVotingStatus: function(hasVoted) {
    if (hasVoted) {
      // User has already voted
      $('.vote-form').hide();
      
      $("#vote-msg").html(`
        <div class="col-sm-6 offset-sm-3">
          <div class="alert alert-success text-center" role="alert">
            <i class="fas fa-check-circle mr-2"></i>
            <span>You have already voted!</span>
          </div>
        </div>
      `);
      
      $("#bv-voted").text("Yes");
    } else {
      // User can vote
      $('.vote-form').show();
      $('#vote-msg').empty();
      $("#bv-voted").text("No");
      App.setupVotingForm();
    }
  },

  /**
   * Set up the voting form with event listeners
   */
  setupVotingForm: function() {
    // Remove existing listeners to prevent duplicates
    $('#candidatesSelect').off('change');
    $('.vote-form').off('submit');
    
    // Add form submission handler
    $('.vote-form').on('submit', function(event) {
      event.preventDefault();
      event.stopPropagation();
      
      // Prevent rapid submissions
      if (App.submitInProgress) {
        console.log("⏳ Submit already in progress");
        return;
      }
      
      App.submitInProgress = true;
      setTimeout(() => App.submitInProgress = false, 1000);
      
      App.castVote();
    });
  },

  // ========================================
  // ELECTION RESULTS
  // ========================================

  /**
   * Load and display election results (admin only)
   */
  loadElectionResults: function() {
    const loader = $("#loader");
    const content = $("#content");
    const resultsTable = $("#electionResults");
    
    // Prevent duplicate loading
    if (App.resultsLoaded) {
      return;
    }
    App.resultsLoaded = true;
    
    // Clear existing data
    resultsTable.empty();
    App.candidateData = [];
    
    let electionInstance;
    
    App.contracts.Election.deployed()
      .then(function(instance) {
        electionInstance = instance;
        return electionInstance.candidatesCount();
      })
      .then(function(candidatesCount) {
        // Get all candidates
        const candidatesPromises = [];
        for (let i = 1; i <= candidatesCount; i++) {
          candidatesPromises.push(electionInstance.candidates(i));
        }
        return Promise.all(candidatesPromises);
      })
      .then(function(candidatesData) {
        // Initialize candidate data
        App.candidateData = candidatesData.map(function(candidate) {
          return {
            id: candidate[0].toNumber(),
            name: candidate[1],
            party: candidate[2],
            votes: 0
          };
        });
        
        // Get vote counts
        return electionInstance.getElectionResults({ from: App.account });
      })
      .then(function(results) {
        // Update vote counts
        const voteCounts = results[2].map(vote => vote.toString());
        
        for (let i = 0; i < voteCounts.length && i < App.candidateData.length; i++) {
          App.candidateData[i].votes = voteCounts[i];
        }
        
        App.displayResults();
        
        loader.hide();
        content.show();
      })
      .catch(function(error) {
        console.error(" Error loading results:", error);
        App.showResultsError();
        
        loader.hide();
        content.show();
        App.resultsLoaded = false; // Allow retry
      });
  },

  /**
   * Display the election results in the table
   */
  displayResults: function() {
    const resultsTable = $("#electionResults");
    resultsTable.empty();
    
    // Populate results table
    App.candidateData.forEach(function(candidate) {
      const row = `
        <tr>
          <td>${candidate.id}</td>
          <td>${candidate.name}</td>
          <td>${candidate.party}</td>
          <td>${candidate.votes}</td>
        </tr>
      `;
      resultsTable.append(row);
    });
    
    // Update UI elements
    if (typeof updateResultsUI === 'function') {
      updateResultsUI(App.candidateData);
    }
    
    document.getElementById('resultTable').style.display = "table";
    document.getElementById('adminWarning').style.display = "none";
  },

  /**
   * Show error when results cannot be loaded (not admin)
   */
  showResultsError: function() {
    $("#adminWarning").html(`
      <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <strong>Error:</strong> Only admin can view election results.
      </div>
    `);
    
    document.getElementById('adminWarning').style.display = "block";
    document.getElementById('resultTable').style.display = "none";
  },

  // ========================================
  // VOTING FUNCTIONALITY
  // ========================================

  /**
   * Cast a vote for the selected candidate
   */
  castVote: function() {
    // Prevent multiple simultaneous votes
    if (App.isVoting) {
      console.log(" Vote already in progress");
      return;
    }
    
    const candidateId = $('#candidatesSelect').val();
    
    if (!candidateId) {
      alert('Please select a candidate!');
      return;
    }
    
    // Set voting state
    App.isVoting = true;
    $("#content").hide();
    $("#loader").show();
    
    console.log(" Casting vote for candidate:", candidateId);
    
    // Submit vote to blockchain
    App.contracts.Election.deployed()
      .then(function(instance) {
        return instance.vote(candidateId, { from: App.account });
      })
      .then(function(result) {
        console.log("Vote transaction successful, waiting for confirmation...");
        // The isVoting flag will be reset when the votedEvent is received
      })
      .catch(function(err) {
        console.error("Error casting vote:", err);
        App.isVoting = false;
        $("#loader").hide();
        $("#content").show();
        alert("There was an error casting your vote. Please try again.");
      });
  }
};

// ========================================
// APPLICATION STARTUP
// ========================================

$(function() {
  $(window).on('load', function() {
    // Show loading state
    $("#content").hide();
    $("#loader").show();
    
    // Reset application state
    App.dataProcessed = false;
    App.resultsLoaded = false;
    App.isVoting = false;
    App.submitInProgress = false;
    App.eventListener = null;
    
    // Initialize the application
    App.init();
  });
});

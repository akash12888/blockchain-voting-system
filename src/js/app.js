var App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  isVoting: false,
  voterData: [],
  candidateData: [],
  eventListener: null,
  submitInProgress: false,

  init: function() {
    return App.initWeb3();
  },

  initWeb3: async function() {
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      web3 = new Web3(window.ethereum);

      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log("Connected to MetaMask");
      } catch (error) {
        console.error("Error requesting account access: ", error);
        alert("Unable to connect to MetaMask.");
      }
    } else {
      if ($("#check-web3").length > 0) {
        $('#check-web3').html(`<div class="alert alert-danger text-center" role="alert">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <span>Please install MetaMask to use this application.</span>
        </div>`);
      } else {
        alert("No MetaMask detected. Please install MetaMask.");
      }
      return;
    }

    return App.initContract();
  },

  initContract: function() {
    $.getJSON("Election.json", function(election) {
      App.contracts.Election = TruffleContract(election);
      App.contracts.Election.setProvider(App.web3Provider);

      App.loadVoterData();
      App.listenForEvents();
      App.listenForAccountChange();

      return App.render();
    });
  },
  
  loadVoterData: async function() {
    try {
      const instance = await App.contracts.Election.deployed();
      const pastEvents = await instance.votedEvent({}, { fromBlock: 0, toBlock: 'latest' });
      
      pastEvents.get(function(error, events) {
        if (error) {
          console.error("Error fetching past events:", error);
          return;
        }
        
        App.voterData = [];
        
        events.forEach(function(event) {
          const voterAddress = event.args._voter;
          const candidateName = event.args._candidateName;
          
          const exists = App.voterData.some(voter => voter.address === voterAddress);
          if (!exists) {
            App.voterData.push({
              address: voterAddress,
              candidateName: candidateName
            });
          }
        });
        
        if ($("#dashboardPage").length > 0) {
          App.renderDashboard();
        }
      });
    } catch (error) {
      console.error("Error loading voter data:", error);
    }
  },

  listenForEvents: async function() {
    try { 
      // If we already have an event listener, don't add another one
      if (App.eventListener) {
        return;
      }
      
      const instance = await App.contracts.Election.deployed();
      
      // Store the event listener to prevent duplicates
      App.eventListener = instance.votedEvent({ fromBlock: 'latest' })
        .watch(function(error, event) {
          if (error) {
            console.error("Error listening for event:", error);
            App.isVoting = false;
            App.render();
            return;
          }
          
          console.log("Event triggered:", event);
          const voterAddress = event.args._voter;
          const candidateName = event.args._candidateName;
          
          const existingVoterIndex = App.voterData.findIndex(voter => voter.address === voterAddress);
          
          if (existingVoterIndex === -1) {
            App.voterData.push({
              address: voterAddress,
              candidateName: candidateName
            });
          } else {
            App.voterData[existingVoterIndex].candidateName = candidateName;
          }

          if ($("#dashboardPage").length > 0) {
            App.renderDashboard();
          }
          
          App.isVoting = false;
          App.render();
        });
    } catch (error) {
      console.error("Error setting up event listener:", error);
    }
  },

  listenForAccountChange: function() {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', function(accounts) {
        if (accounts.length === 0) {
          console.log('MetaMask is locked or no accounts are available');
          alert('Please unlock MetaMask and ensure accounts are available.');
          return;
        }

        App.account = accounts[0];
        console.log("New account detected:", App.account);
        App.render();
      });
    }
  },

  render: function() {
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    if (App.isVoting) {
      return;
    }

    web3.eth.getAccounts(function(err, account) {
      if (err) {
        console.error(err);
        loader.hide();
        content.show();
        return;
      }

      App.account = account[0];
      
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
  
  renderDashboard: function() {
    var loader = $("#loader");
    var content = $("#content");
  
    // Clear the table first
    $("#voterTable").empty();
    
    // Make sure the no-votes message is hidden initially
    $("#no-votes").hide();
  
    // Set a flag to track if we've already processed the data
    if (App.dataProcessed) {
      // If data was already processed, just show the content
      loader.hide();
      content.show();
      return;
    }
  
    // Create a delay to ensure data has time to load
    setTimeout(function() {
      // Set the flag to prevent duplicate processing
      App.dataProcessed = true;
      
      if (App.voterData.length === 0) {
        // Only show the message if there are no votes after waiting
        $("#no-votes").show();
      } else {
        $("#no-votes").hide();
        
        // Clear the table again just to be safe
        $("#voterTable").empty();
        
        App.voterData.forEach(function(voter, index) {
          var row = `<tr>
            <td>${index + 1}</td>
            <td>${voter.address}</td>
            <td>${voter.candidateName}</td>
          </tr>`;
          $("#voterTable").append(row);
        });
      }
  
      // Hide loader and show content after the delay
      loader.hide();
      content.show();
    }, 500); // 0.5 second delay 
  },

  renderVotingPage: function() {
    var electionInstance;
    var loader = $("#loader");
    var content = $("#content");
  
    if ($("#accountAddress").length > 0) {
      $("#accountAddress").html(`<span style="font-size:14px;">Your Voter's Address: 
        <span style="font-weight:600">${App.account}</span></span><br><br>
      `);
    }
  
    App.contracts.Election.deployed().then(function(instance) {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then(function(candidatesCount) {
      var candidatesPromises = [];
      for (var i = 1; i <= candidatesCount; i++) {
        candidatesPromises.push(electionInstance.candidates(i));
      }
      
      return Promise.all([Promise.all(candidatesPromises), electionInstance.voters(App.account)]);
    }).then(function(results) {
      var candidatesData = results[0];
      var hasVoted = results[1];
      
      if ($("#candidatesResults").length > 0) {
        var candidatesResults = $("#candidatesResults");
        candidatesResults.empty();
        
        candidatesData.forEach(function(candidate) {
          var id = candidate[0];
          var name = candidate[1];
          var party = candidate[2];
          
          var candidateTemplate = `<tr><th>${id}</th><td>${name}</td><td>${party}</td></tr>`;
          candidatesResults.append(candidateTemplate);
        });
      }
      
      if ($("#candidatesSelect").length > 0) {
        var candidatesSelect = $('#candidatesSelect');
        candidatesSelect.empty();
        
        candidatesData.forEach(function(candidate) {
          var id = candidate[0];
          var name = candidate[1];
          var party = candidate[2];
          
          var candidateOption = `<option value="${id}"> ${name} (${party}) </option>`;
          candidatesSelect.append(candidateOption);
        });
      }
      
      if (hasVoted) {
        if ($('.vote-form').length > 0) {
          $('.vote-form').hide();
        }
        
        if ($("#vote-msg").length > 0) {
          $('#vote-msg').html(`
            <div class="col-sm-6 offset-sm-3 col-lg-6 offset-lg-3 col-md-6 offset-md-3">
              <div class="alert alert-success text-center" role="alert">
                <i class="fas fa-check-circle mr-2"></i>
                <span>You have already voted!</span>
              </div>
            </div>`);
        }
        
        if ($("#bv-voted").length > 0) {
          $('#bv-voted').text(`Yes`);
        }
      } else {
        if ($('.vote-form').length > 0) {
          $('.vote-form').show();
        }
        
        if ($("#vote-msg").length > 0) {
          $('#vote-msg').empty();
        }
        
        if ($("#bv-voted").length > 0) {
          $('#bv-voted').text(`No`);
        }
        
        // Make sure we're not adding duplicate event listeners
        $('#candidatesSelect').off('change');
        
        // Add event listener for the entire form with protection against duplicate triggers
        $('.vote-form').off('submit').on('submit', function(event) {
          event.preventDefault();
          event.stopPropagation(); // Stop event bubbling
          
          
          if (App.submitInProgress) {
            console.log("Submit already in progress, ignoring additional attempt");
            return;
          }
          
          App.submitInProgress = true;
          
          setTimeout(function() {
            App.submitInProgress = false;
          }, 1000); // Reset after 1 second
          
          App.castVote();
        });
      }
      
      loader.hide();
      content.show();
    }).catch(function(error) {
      console.error("Error rendering voting page:", error);
      loader.hide();
      content.show();
    });
  },

  loadElectionResults: function() {
    var loader = $("#loader");
    var content = $("#content");
    var resultsTable = $("#electionResults");
    
    // Flag to prevent multiple executions
    if (App.resultsLoaded) {
      return;
    }
    
    // Set the flag immediately
    App.resultsLoaded = true;
    
    // Clear the table completely before starting
    resultsTable.empty();
    App.candidateData = [];
    
    App.contracts.Election.deployed().then(function(instance) {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then(function(candidatesCount) {
      var candidatesPromises = [];
      for (var i = 1; i <= candidatesCount; i++) {
        candidatesPromises.push(electionInstance.candidates(i));
      }
      
      return Promise.all(candidatesPromises);
    }).then(function(candidatesData) {
      // Reset the array to ensure it's clean
      App.candidateData = [];
      
      candidatesData.forEach(function(candidate) {
        App.candidateData.push({
          id: candidate[0].toNumber(),
          name: candidate[1],
          party: candidate[2],
          votes: 0
        });
      });
      
      // Now get the results
      return App.contracts.Election.deployed().then(function(instance) {
        return instance.getElectionResults({ from: App.account });
      });
    }).then(function(results) {
      var voteCounts = results[2].map(vote => vote.toString());
      
      for (var i = 0; i < voteCounts.length && i < App.candidateData.length; i++) {
        App.candidateData[i].votes = voteCounts[i];
      }
      
      // Clear the table AGAIN just to be completely sure
      resultsTable.empty();
      
      // Populate the table with the data
      App.candidateData.forEach(function(candidate) {
        var row = `<tr>
          <td>${candidate.id}</td>
          <td>${candidate.name}</td>
          <td>${candidate.party}</td>
          <td>${candidate.votes}</td>
        </tr>`;
        resultsTable.append(row);
      });
      
      // Only call updateResultsUI if it exists
      if (typeof updateResultsUI === 'function') {
        updateResultsUI(App.candidateData);
      }
      
      document.getElementById('resultTable').style.display = "table";
      document.getElementById('adminWarning').style.display = "none";
      
      loader.hide();
      content.show();
    }).catch(function(error) {
      console.error("Error loading election results:", error);
      
      $("#adminWarning").html(`
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <strong>Error:</strong> Only admin can view election results.
        </div>
      `);
      
      document.getElementById('adminWarning').style.display = "block";
      document.getElementById('resultTable').style.display = "none";
      
      loader.hide();
      content.show();
      
      // Reset the flag in case of error, to allow retrying
      App.resultsLoaded = false;
    });
  },

  castVote: function() {
    // If already voting, prevent another attempt
    if (App.isVoting) {
      console.log("Vote already in progress, ignoring additional attempt");
      return;
    }
    
    var candidateId = $('#candidatesSelect').val();
    
    if (!candidateId) {
      alert('Please select a candidate!');
      return;
    }
    
    // Set voting flag immediately to block additional attempts
    App.isVoting = true;
    $("#content").hide();
    $("#loader").show();
    
    
    console.log("Initiating vote transaction for candidate:", candidateId);
    
    App.contracts.Election.deployed().then(function(instance) {
      return instance.vote(candidateId, { from: App.account });
    }).then(function(result) {
      console.log("Vote transaction successful, waiting for confirmation...");
      // The isVoting flag will be reset when the votedEvent is received
    }).catch(function(err) {
      console.error("Error casting vote:", err);
      App.isVoting = false;
      $("#loader").hide();
      $("#content").show();
      alert("There was an error casting your vote. Please try again.");
    });
  }
};

$(function() {
  $(window).on('load', function() {
    $("#content").hide();
    $("#loader").show();
    
    // Reset any flags that might persist between page loads
    App.dataProcessed = false;
    App.resultsLoaded = false;
    App.isVoting = false;
    App.submitInProgress = false;
    App.eventListener = null;
    
    App.init();
  });
});
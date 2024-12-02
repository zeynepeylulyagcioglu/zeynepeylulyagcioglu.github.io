document.addEventListener('DOMContentLoaded', () => {
    let position = 0;
    let steps = 0;
    const maxSteps = 100;
    let isSimulating = false;
    const runLengths = [];
    let isAnalyzed = false; // Ensure analysis happens only once


    // Embedded PMF Data from your JSON file
    const discretizedPMF = {
        "1": 0.20192307692307693,
        "2": 0.022435897435897436,
        "3": 0.016025641025641024,
        "4-5": 0.041666666666666664,
        "6-7": 0.04326923076923077,
        "8-10": 0.12179487179487178,
        "11-15": 0.15705128205128205,
        "16-20": 0.10416666666666667,
        "21-30": 0.14262820512820512,
        "31-50": 0.10897435897435895,
        "51-100": 0.040064102564102574
    };

    const stickFigure = document.getElementById('stick-figure');
    const stepsTaken = document.getElementById('steps-taken');
    const positionDisplay = document.getElementById('position');
    const resultDisplay = document.getElementById('result');
    const randomWalkButton = document.getElementById('random-walk');

    const humanMean = 16.05;
    const humanStddev = 5.55;
    const computerMean = 2;
    const computerStddev = 0.57;

    function getDiscretizedPMF(runLength) {
        for (const [bucket, prob] of Object.entries(discretizedPMF)) {
            if (bucket.includes('-')) { 
                const [start, end] = bucket.split('-').map(Number);
                if (runLength >= start && runLength <= end) return prob || 0;
            } else { 
                const start = Number(bucket);
                if (runLength === start) return prob || 0;
            }
        }
        console.warn(`Run length ${runLength} not found in PMF buckets. Returning 0.`);
        return 0;
    }
    
    function moveCharacter(direction) {
        if (steps >= maxSteps) {
            resultDisplay.textContent = 'Maximum steps reached!';
            return;
        }

        if (runLengths.length === 0 || direction !== runLengths[runLengths.length - 1][0]) {
            runLengths.push([direction, 1]);
        } else {
            runLengths[runLengths.length - 1][1]++;
        }

        position += direction;
        steps++;

        const offset = position * 10;
        stickFigure.style.left = `calc(50% + ${offset}px)`;

        stepsTaken.textContent = steps;
        positionDisplay.textContent = position;

        if (steps === maxSteps) analyzeWalkData(runLengths.map(([_, length]) => length));
    }

    const resetButton = document.getElementById('reset');
    resetButton.addEventListener("click", () => {
        isAnalyzed = false; // Reset analysis state
        location.reload(); // Reload the page to start fresh
    });
    
    document.addEventListener('keydown', (event) => {
        if (isSimulating || steps >= maxSteps) return; // Prevent key presses if simulation is active
    
        if (event.key === 'ArrowRight') {
            moveCharacter(1); // Move forward
        } else if (event.key === 'ArrowLeft') {
            moveCharacter(-1); // Move backward
        }
    });
    
    function startRandomWalk() {
        if (isSimulating || isAnalyzed) return; // Prevent starting a new simulation if one is active or already analyzed
    
        isSimulating = true;
        const interval = setInterval(() => {
            if (steps >= maxSteps) {
                clearInterval(interval); // Stop the interval
                isSimulating = false; // Reset simulation state
                analyzeWalkData(runLengths.map(([_, length]) => length)); // Trigger analysis
                return;
            }
    
            const direction = Math.random() < 0.5 ? -1 : 1;
            moveCharacter(direction);
        }, 200);
    }    

    randomWalkButton.addEventListener('click', startRandomWalk);

    function analyzeWalkData(runLengths) {
        if (isAnalyzed) return; // Prevent multiple calls
        isAnalyzed = true; // Mark as analyzed to prevent future calls
    
        let logProbHuman = 0;
        let logProbComputer = 0;
        let discretizedLogProbHuman = 0;
        let discretizedLogProbComputer = 0;
        const epsilon = 1e-10;
        const geoP = 0.5;
    
        runLengths.forEach((run) => {
            const probHuman = Math.max(normPDF(run, humanMean, humanStddev), epsilon);
            const probComputer = Math.max(normPDF(run, computerMean, computerStddev), epsilon);
            logProbHuman += Math.log(probHuman);
            logProbComputer += Math.log(probComputer);
    
            const probHumanDiscretized = Math.max(getDiscretizedPMF(run), epsilon);
            const probComputerDiscretized = Math.max(geomPDF(run, geoP), epsilon);
            discretizedLogProbHuman += Math.log(probHumanDiscretized);
            discretizedLogProbComputer += Math.log(probComputerDiscretized);
        });
    
        const logLikelihoodRatio = logProbHuman - logProbComputer;
        const discretizedLogLikelihoodRatio = discretizedLogProbHuman - discretizedLogProbComputer;
    
        const decision =
            logLikelihoodRatio > 0
                ? "HUMAN 👋"
                : logLikelihoodRatio < 0
                ? "COMPUTER 🤖"
                : "HUMAN 👋";
    
        const discretizedDecision =
            discretizedLogLikelihoodRatio > 0
                ? "HUMAN 👋"
                : discretizedLogLikelihoodRatio < 0
                ? "COMPUTER 🤖"
                : "HUMAN 👋";
    
        resultDisplay.innerHTML = `
            <h2>Continuous Probability Analysis 🔎</h2>
            <p>Log Joint Probability (Human): ${logProbHuman.toFixed(6)}</p>
            <p>Log Joint Probability (Computer): ${logProbComputer.toFixed(6)}</p>
            <p>Log-Likelihood Ratio: ${logLikelihoodRatio.toFixed(6)}</p>
            <p><strong>Decision: These 👣 👣 👣 more likely belong to a ${decision}</strong></p>
        `;
    
        document.getElementById("discretized-log-prob-human").textContent = discretizedLogProbHuman.toFixed(6);
        document.getElementById("discretized-log-prob-computer").textContent = discretizedLogProbComputer.toFixed(6);
        document.getElementById("discretized-log-likelihood-ratio").textContent = discretizedLogLikelihoodRatio.toFixed(6);
        document.getElementById("discretized-decision").textContent = `These 👣 👣 👣 more likely belong to a ${discretizedDecision}`;
    
        plotRunLengths(runLengths);
        displayProjectInsights();
    }
    

    function geomPDF(x, p) {
        return p * Math.pow(1 - p, x - 1);
    }

    function normPDF(x, mean, stddev) {
        const factor = 1 / (stddev * Math.sqrt(2 * Math.PI));
        const exponent = -0.5 * Math.pow((x - mean) / stddev, 2);
        return factor * Math.exp(exponent);
    }

    // Example of proper initialization for the bar chart
    function plotRunLengths(runLengths) {
        const ctx = document.getElementById("chart").getContext("2d");

        const runLengthCounts = {};
        runLengths.forEach((run) => {
            runLengthCounts[run] = (runLengthCounts[run] || 0) + 1;
        });

        const labels = Object.keys(runLengthCounts).map(Number).sort((a, b) => a - b);
        const data = labels.map((label) => runLengthCounts[label]);

        if (window.runLengthChart) {
            window.runLengthChart.destroy();
        }

        window.runLengthChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Run Length Distribution",
                    data: data,
                    backgroundColor: "rgba(75, 192, 192, 0.6)",
                    borderColor: "rgba(75, 192, 192, 1)",
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: "Run Length Distribution for Completed Walk",
                    },
                },
                scales: {
                    x: { title: { display: true, text: "Run Length" } },
                    y: { title: { display: true, text: "Frequency" } },
                },
            },
        });
    }

    function plotDiscretizedPMF() {
        const ctx = document.getElementById("discretized-chart").getContext("2d");
    
        // Prepare data from discretized PMF
        const labels = Object.keys(discretizedPMF); // Discretized bucket ranges
        const data = Object.values(discretizedPMF); // Corresponding probabilities
    
        if (window.discretizedChart) {
            window.discretizedChart.destroy(); // Destroy any existing chart instance
        }
    
        // Create a bar chart for the discretized PMF
        window.discretizedChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Discretized PMF",
                    data: data,
                    backgroundColor: "rgba(54, 162, 235, 0.6)", // Blue bars
                    borderColor: "rgba(54, 162, 235, 1)",
                    borderWidth: 1,
                }],
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: "Discretized PMF of Run Lengths",
                    },
                },
                scales: {
                    x: { title: { display: true, text: "Run Length Buckets" } },
                    y: { title: { display: true, text: "Probability" } },
                },
            },
        });
    }

    function displayProjectInsights() {
        const insightsContainer = document.createElement("div");
        insightsContainer.classList.add("project-insights");
    
        insightsContainer.innerHTML = `
            <div class="insights-section">
                <h2>Classifying Random Walks: Are They Human or Computer-Generated?</h2>
                
                <!-- Introduction -->
                <div class="insights-card">
                    <h3>Introduction</h3>
                    <p>
                        Randomness surrounds us, from the fluttering of leaves in the wind to the strategic decisions of a chess master. 
                        But is all randomness created equal? This project delves into the intriguing question of whether we can distinguish 
                        between <strong>human-generated</strong> and <strong>computer-generated random walks</strong> using probabilistic models 
                        and statistical analysis.
                    </p>
                    <p>
                        At the core of this endeavor lies the concept of "run lengths," which are sequences of consecutive steps in the same direction. 
                        By analyzing these patterns, the project uncovers subtle yet meaningful differences between human behavior and algorithmic randomness.
                    </p>
                    <p>
                        The objective is simple yet captivating: Given a random walk of 100 steps, determine whether it was generated by a human or a computer. 
                        The solution lies in comparing how well the walk matches statistical models designed for each type of randomness.
                    </p>
                </div>
    
                <!-- How It Works -->
                <div class="insights-card">
                    <h3>How It Works</h3>
                    <p>
                        The foundation of this project is <strong>Bayesian Classification</strong>:
                    </p>
                    <ul>
                        <li>We calculate the likelihood of a walk being generated by a human \\( P(W \\mid H) \\) or a computer \\( P(W \\mid C) \\).</li>
                        <li>
                            The classification decision is based on which model has the higher likelihood:
                            <blockquote>
                                \\[
                                \\frac{P(H \\mid W)}{P(C \\mid W)} = \\frac{P(W \\mid H)}{P(W \\mid C)}.
                                \\]
                            </blockquote>
                        </li>
                    </ul>
                    <h4>Why Does This Work?</h4>
                    <p>
                        Human-generated and computer-generated random walks exhibit distinct patterns:
                    </p>
                    <ul>
                        <li><strong>Computer-generated walks:</strong> Governed by well-defined statistical distributions like the <em>geometric distribution</em>, these walks are predictable and consistent.</li>
                        <li><strong>Human-generated walks:</strong> Influenced by biases, variability, and cognitive tendencies, human randomness often deviates from purely mathematical models. 
                            For instance, humans tend to favor longer runs and occasionally exhibit patterns that reflect deliberate or subconscious choices.
                        </li>
                    </ul>
                </div>
    
                <!-- Key Findings -->
                <div class="insights-card">
                    <h3>Key Findings</h3>
                    <h4>1. Continuous Model Analysis</h4>
                    <p>
                        The continuous model leverages the <strong>Central Limit Theorem (CLT)</strong> to analyze the <em>mean run-length per walk</em>:
                    </p>
                    <ul>
                        <li>For human-generated walks, the mean run-length \\( \\mu_H \\) was estimated at <strong>16.05</strong> with a variance \\( \\sigma_H^2 \\) of <strong>5.55</strong>, calculated using bootstrapping.</li>
                        <li>For computer-generated walks, the theoretical mean run-length is <strong>2</strong>, with variance empirically adjusted to <strong>0.57</strong> to align with observed data.</li>
                    </ul>
                    <div class="image-row">
                        <figure>
                            <img src="human_clt.png" alt="CLT Approximation for Human Walks">
                            <figcaption>CLT Approximation for Human Walks</figcaption>
                        </figure>
                        <figure>
                            <img src="computer_clt.png" alt="CLT Approximation for Computer Walks">
                            <figcaption>CLT Approximation for Computer Walks</figcaption>
                        </figure>
                    </div>
                    <h4>2. Discrete Model Analysis</h4>
                    <p>
                        The discrete model uses the <strong>probability mass function (PMF)</strong> to analyze run lengths:
                    </p>
                    <ul>
                        <li><strong>Human walks:</strong> Run lengths were grouped into non-uniform "buckets" to emphasize distinguishing patterns, especially for longer runs.</li>
                        <li><strong>Computer walks:</strong> Run lengths follow the theoretical geometric distribution \\( \\text{Geo}(0.5) \\), which predicts a rapid decay in probabilities for longer runs.</li>
                    </ul>
                    <figure>
                        <img src="bucket_pmf.png" alt="Bucketed PMF for Human Walks">
                        <figcaption>Bucketed PMF for Human Walks</figcaption>
                    </figure>
                </div>
    
                <!-- How Your Walk is Classified -->
                <div class="insights-card">
                    <h3>How Your Walk is Classified</h3>
                    <ol>
                        <li><strong>Extracts Run Lengths:</strong> Identifies the sequence of consecutive steps in the same direction.</li>
                        <li>
                            <strong>Calculates Likelihoods:</strong>
                            <ul>
                                <li>Computes the likelihood of the walk under the human model \\( P(W \\mid H) \\).</li>
                                <li>Computes the likelihood under the computer model \\( P(W \\mid C) \\).</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Log-Likelihood Ratio:</strong> Compares the two likelihoods using the formula:
                            <blockquote>
                                \\[
                                \\log \\frac{P(W \\mid H)}{P(W \\mid C)} = \\log P(W \\mid H) - \\log P(W \\mid C).
                                \\]
                            </blockquote>
                        </li>
                        <li><strong>Final Decision:</strong> Determines whether the walk is more likely human or computer-generated based on the higher likelihood.</li>
                    </ol>
                </div>
    
                <!-- Interactive Results -->
                <div class="insights-card">
                    <h3>Interactive Results</h3>
                    <ul>
                        <li><strong>Your Walk's Visualization:</strong> A graph showing the sequence of steps in your walk.</li>
                        <li><strong>Likelihoods:</strong> Detailed calculations of \\( P(W \\mid H) \\) and \\( P(W \\mid C) \\).</li>
                        <li><strong>Classification Decision:</strong> The final verdict—human or computer-generated?</li>
                        <li><strong>Comparison with Data:</strong> Visual alignments of your walk's run-length patterns with those of human and computer walks.</li>
                    </ul>
                </div>
    
                <!-- Insights -->
                <div class="insights-card">
                    <h3>Insights from This Project</h3>
                    <ol>
                        <li><strong>Humans Defy Pure Randomness:</strong> Human-generated walks reflect biases and variability, deviating from the mathematical rigor of computer-generated randomness.</li>
                        <li><strong>The CLT Unveils Patterns:</strong> Aggregating run lengths into a mean (via the Central Limit Theorem) reduces noise and highlights the unique characteristics of human walks.</li>
                        <li><strong>Bucketed PMFs Add Precision:</strong> Grouping run lengths into tailored buckets enhances the ability to distinguish long and short runs, a crucial factor for classification.</li>
                    </ol>
                </div>
    
                <!-- Try It Yourself -->
                <div class="insights-card">
                    <h3>Try It Yourself!</h3>
                    <p>
                        Simulate a random walk above and discover whether your randomness is human or computer-generated. 
                        Explore the fascinating interplay of probability, patterns, and decision-making in this interactive challenge.
                    </p>
                </div>
    
                <!-- Additional Resources -->
                <div class="insights-card">
                    <h3>Additional Resources</h3>
                    <ul>
                        <li><a href="https://github.com/zeynepeylulyagcioglu/randomWalk" target="_blank">GitHub Repository</a>: Explore the source code behind this project.</li>
                        <li><a href="https://github.com/zeynepeylulyagcioglu/randomWalk/tree/main/paper" target="_blank">Research Paper (PDF)</a>: Read the full analysis and methodology in detail.</li>
                    </ul>
                </div>
            </div>
        `;
    
        const container = document.querySelector(".container");
        container.appendChild(insightsContainer);
    
        // Trigger MathJax to process new content
        if (window.MathJax) {
            MathJax.typesetPromise().catch((err) => console.error("MathJax typeset failed: ", err));
        }
    }
   
});
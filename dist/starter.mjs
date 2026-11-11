// Original Trace teaching content. External reading is background, not the text being quoted.
export const STARTER_COURSES = [
  {
    id: "trace-starter-bayes",
    title: "When 90% accurate is wrong",
    description:
      "An original three-part spam-filter lesson with predictions, retrieval practice and a frequency lab. Evidence excerpts quote Trace-authored notes; OpenStax is the external background reading.",
    createdAt: "2026-11-10T00:00:00.000Z",
    origin: "starter",
    source: {
      title:
        "Trace-authored course notes · grounded in OpenStax probability reading; not OpenStax quotations",
      url: "https://openstax.org/books/principles-data-science/pages/3-4-probability-theory",
      text: "TRACE ORIGINAL COURSE NOTES\nThese explanations, prompts and numerical spam-filter examples were authored for Trace. They are not quotations from OpenStax. The reading link provides external grounding for conditional probability and Bayes' theorem, not independent verification of these notes.\n\n01 · Start with the crowd\nPrediction: An inbox filter is 90% accurate. Would you trust it to find spam? Before answering, ask what was counted as correct and how common spam was in that inbox.\n\nThe base rate is the share of messages that are spam before the filter examines them. If 10% of 1,000 messages are spam, there are 100 spam messages and 900 legitimate messages.\n\nA filter that calls every message legitimate gets 900 of those 1,000 messages right: 90% overall accuracy, while catching no spam. A headline score can hide failure on the smaller group.\n\nTransfer: If only 1% of messages are spam, the same always-legitimate filter is 99% accurate and still catches none. Ask for the base rate and separate error counts before comparing filters.\n\n02 · Two paths to a flag\nPrediction: Now the filter catches 90% of spam but also flags 10% of legitimate messages. In an inbox with 1% spam, will most flagged messages really be spam?\n\nUse 1,000 messages as a counting frame: 10 are spam and 990 are legitimate. Sensitivity is the share of actual spam that gets flagged. Here it yields 9 true positives and 1 false negative.\n\nThe false-positive rate is the share of legitimate messages incorrectly flagged, not the share of flags that are wrong. A 10% false-positive rate on 990 legitimate messages produces 99 false positives; the other 891 are true negatives.\n\nThere are 108 flags: 9 real spam and 99 legitimate messages. Only 9 / 108, about 8.3%, of flags are spam. This filter is still 90% accurate overall because 9 + 891 of the 1,000 classifications are correct.\n\nTransfer: Explain why a small error rate applied to a large group can outweigh a high detection rate applied to a small group. These are expected counts under the stated rates, not a guaranteed observed inbox.\n\n03 · Update by counting\nPrediction: Keep sensitivity at 90% and the false-positive rate at 10%, but raise the spam base rate from 1% to 10%. Will the same filter make its flags more trustworthy?\n\nOf 1,000 messages, expect 100 spam and 900 legitimate messages. The filter flags 90 spam and 90 legitimate messages. Among the 180 flags, half are spam: 90 / 180 = 50%.\n\nBayes in counts: probability of spam given a flag = true positives / (true positives + false positives). First split by actual message type, then apply each group's flag rate, then compare only the flagged messages. If nothing is flagged, this conditional probability is undefined.\n\nTry the frequency lab: return the base rate to 1% and reduce the false-positive rate to 1%, keeping sensitivity at 90%. Expected flags become 9 spam and 9.9 legitimate messages, so 9 / 18.9 is about 47.6%. Fractional counts describe averages across comparable inboxes.\n\nTransfer: Doubling the population while holding all rates fixed doubles every expected count but leaves the share of flags that are spam unchanged. The lab assumes the entered rates apply to this inbox; it does not measure a real filter.",
    },
    lessons: [
      {
        id: "trace-bayes-base-rates",
        title: "01 · Start with the crowd",
        paragraphs: [
          "Prediction: An inbox filter is 90% accurate. Would you trust it to find spam? Before answering, ask what was counted as correct and how common spam was in that inbox.",
          "The base rate is the share of messages that are spam before the filter examines them. If 10% of 1,000 messages are spam, there are 100 spam messages and 900 legitimate messages.",
          "A filter that calls every message legitimate gets 900 of those 1,000 messages right: 90% overall accuracy, while catching no spam. A headline score can hide failure on the smaller group.",
          "Transfer: If only 1% of messages are spam, the same always-legitimate filter is 99% accurate and still catches none. Ask for the base rate and separate error counts before comparing filters.",
        ],
        quote:
          "A filter that calls every message legitimate gets 900 of those 1,000 messages right: 90% overall accuracy, while catching no spam.",
        cards: [
          {
            id: "trace-bayes-card-1",
            prompt: "What does the spam base rate describe?",
            answer:
              "The share of all messages that are spam before considering the filter result.",
            quote:
              "The base rate is the share of messages that are spam before the filter examines them.",
          },
          {
            id: "trace-bayes-card-2",
            prompt:
              "An inbox has 100 spam and 900 legitimate messages. How accurate is a filter that never flags anything, and how much spam does it catch?",
            answer:
              "It is 90% accurate overall and catches zero spam messages.",
            quote:
              "A filter that calls every message legitimate gets 900 of those 1,000 messages right: 90% overall accuracy, while catching no spam.",
          },
          {
            id: "trace-bayes-card-3",
            prompt:
              "Why can 99% overall accuracy be a poor measure of spam detection?",
            answer:
              "If only 1% of messages are spam, a filter can achieve 99% accuracy by labeling every message legitimate and missing all spam.",
            quote:
              "If only 1% of messages are spam, the same always-legitimate filter is 99% accurate and still catches none.",
          },
        ],
      },
      {
        id: "trace-bayes-false-positives",
        title: "02 · Two paths to a flag",
        paragraphs: [
          "Prediction: Now the filter catches 90% of spam but also flags 10% of legitimate messages. In an inbox with 1% spam, will most flagged messages really be spam?",
          "Use 1,000 messages as a counting frame: 10 are spam and 990 are legitimate. Sensitivity is the share of actual spam that gets flagged. Here it yields 9 true positives and 1 false negative.",
          "The false-positive rate is the share of legitimate messages incorrectly flagged, not the share of flags that are wrong. A 10% false-positive rate on 990 legitimate messages produces 99 false positives; the other 891 are true negatives.",
          "There are 108 flags: 9 real spam and 99 legitimate messages. Only 9 / 108, about 8.3%, of flags are spam. This filter is still 90% accurate overall because 9 + 891 of the 1,000 classifications are correct.",
          "Transfer: Explain why a small error rate applied to a large group can outweigh a high detection rate applied to a small group. These are expected counts under the stated rates, not a guaranteed observed inbox.",
        ],
        quote:
          "There are 108 flags: 9 real spam and 99 legitimate messages. Only 9 / 108, about 8.3%, of flags are spam.",
        cards: [
          {
            id: "trace-bayes-card-4",
            prompt:
              "Which group is the denominator of the false-positive rate?",
            answer:
              "All actual legitimate messages, including both correctly unflagged and incorrectly flagged legitimate messages.",
            quote:
              "The false-positive rate is the share of legitimate messages incorrectly flagged, not the share of flags that are wrong.",
          },
          {
            id: "trace-bayes-card-5",
            prompt:
              "For 1,000 messages with 1% spam, 90% sensitivity and 10% false-positive rate, how many true and false positives are expected?",
            answer: "9 true positives and 99 false positives.",
            quote:
              "There are 108 flags: 9 real spam and 99 legitimate messages.",
          },
          {
            id: "trace-bayes-card-6",
            prompt:
              "Why is 90% sensitivity different from an 8.3% chance that a flag is spam?",
            answer:
              "Sensitivity starts with actual spam; the 8.3% calculation starts with all flagged messages, including false positives. The denominators differ.",
            quote:
              "Sensitivity is the share of actual spam that gets flagged. Here it yields 9 true positives and 1 false negative.\n\nThe false-positive rate is the share of legitimate messages incorrectly flagged, not the share of flags that are wrong. A 10% false-positive rate on 990 legitimate messages produces 99 false positives; the other 891 are true negatives.\n\nThere are 108 flags: 9 real spam and 99 legitimate messages. Only 9 / 108, about 8.3%, of flags are spam.",
          },
        ],
      },
      {
        id: "trace-bayes-frequency",
        title: "03 · Update by counting",
        paragraphs: [
          "Prediction: Keep sensitivity at 90% and the false-positive rate at 10%, but raise the spam base rate from 1% to 10%. Will the same filter make its flags more trustworthy?",
          "Of 1,000 messages, expect 100 spam and 900 legitimate messages. The filter flags 90 spam and 90 legitimate messages. Among the 180 flags, half are spam: 90 / 180 = 50%.",
          "Bayes in counts: probability of spam given a flag = true positives / (true positives + false positives). First split by actual message type, then apply each group's flag rate, then compare only the flagged messages. If nothing is flagged, this conditional probability is undefined.",
          "Try the frequency lab: return the base rate to 1% and reduce the false-positive rate to 1%, keeping sensitivity at 90%. Expected flags become 9 spam and 9.9 legitimate messages, so 9 / 18.9 is about 47.6%. Fractional counts describe averages across comparable inboxes.",
          "Transfer: Doubling the population while holding all rates fixed doubles every expected count but leaves the share of flags that are spam unchanged. The lab assumes the entered rates apply to this inbox; it does not measure a real filter.",
        ],
        quote:
          "Bayes in counts: probability of spam given a flag = true positives / (true positives + false positives).",
        simulator: true,
        cards: [
          {
            id: "trace-bayes-card-7",
            prompt:
              "With 10% spam, 90% sensitivity and 10% false-positive rate, what fraction of flags are spam?",
            answer:
              "50%: 90 true positives divided by 90 true positives plus 90 false positives.",
            quote: "Among the 180 flags, half are spam: 90 / 180 = 50%.",
          },
          {
            id: "trace-bayes-card-8",
            prompt:
              "How do you calculate the chance that a flagged message is spam, and what if there are no flags?",
            answer:
              "Divide true positives by all positives (true positives plus false positives). With no flags, the denominator is zero, so the conditional probability is undefined.",
            quote:
              "Bayes in counts: probability of spam given a flag = true positives / (true positives + false positives). First split by actual message type, then apply each group's flag rate, then compare only the flagged messages. If nothing is flagged, this conditional probability is undefined.",
          },
          {
            id: "trace-bayes-card-9",
            prompt:
              "If inbox size doubles while every rate stays fixed, what happens to expected counts and the share of flags that are spam?",
            answer:
              "All expected counts double; the share of flags that are spam stays the same.",
            quote:
              "Doubling the population while holding all rates fixed doubles every expected count but leaves the share of flags that are spam unchanged.",
          },
        ],
      },
    ],
  },
];

URL: https://rapidapi.com/8v2FWW4H6AmKw89/api/youtube-transcripts

## Spotlights

## API Overview

High performance and availablility API designed for generating YouTube video transcripts.

Uses multiple methods and fallbacks to produce the transcript. Note: despite using different approaches, not all videos can have a transcript generated.

Part of Supadata ([https://supadata.ai](https://supadata.ai/)), a family of APIs created to empower developers and creators in the AI industry.

Enter YouTube video URL, get transcript. Simple as that.

## **Getting Started**

To begin using Supadata YouTube Transcript API, follow these steps and make your first API call:

-   **Subscribe to a plan:** Visit our [Pricing page](https://rapidapi.com/8v2FWW4H6AmKw89/api/youtube-transcripts/pricing) and subscribe to one of the plans. If you are just starting, you can subscribe to the free BASIC plan of the API with 100 requests per month (hard-limited and no credit card required).
-   **Make your first API call:** Visit the RapidAPI Playground - the "Get Transcript" endpoint should be selected and displayed on the main panel view. Since there is already a default query parameter value (query/keyword), just click the blue "Test endpoint" button to make a your first API call. The JSON response will be displayed on the right panel.
-   **Documentation and Resources:** Refer to the detailed endpoint, parameter descriptions, and examples provided in the Endpoints tab under each endpoint. Code snippets are available for all popular programming languages and environments, including - Javascript, Python, Java, Shell, and many others, to help you easily integrate the API into your project or workflow.

You should be good to go now!

## **Authentication**

To authenticate with the API, send the X-RapidAPI-Host header with a value of "youtube-transcript.p.rapidapi.com" along with the X-RapidAPI-Key header set with your RapidAPI App API Key (as shown in the endpoint Code Snippets).

## **Response Structure**

Here is an example of the response structure from the API server:

```
{
  "content": {
      ...
  }
}
```

Here is an example of the response structure from my API server in case an error occurs:

```
{
    "error": "Missing parameters"
}
```

```
{
    "error": "Something went wrong with the request"
}
```

Please note that some errors might be returned by the RapidAPI gateway and will have a different structure. Please refer to the Error Handling / Error Response Structure section for more details.

In addition, RapidAPI gateway adds several headers to each response, for more information, please refer to [https://docs.rapidapi.com/docs/response-headers](https://docs.rapidapi.com/docs/response-headers)

## **Endpoints**

For detailed endpoint parameters and responses documentation and examples, and to try the API, please refer to the Endpoints section of the API.

## Get Transcript

### **GET /youtube/transcript**

Extract transcripts and subtitles from YouTube videos with our powerful API.

#### Query Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | Yes\* | YouTube video URL (full or shortened) |
| `videoId` | string | Yes\* | YouTube video ID (alternative to URL) |
| `text` | boolean | No | Return plain text transcript (default: false) |
| `chunkSize` | number | No | Maximum characters per transcript chunk (when text=false) |

-   Either `url` or `videoId` must be provided.

#### Supported URL formats

Supports various YouTube URL formats, eg:

```
http://youtu.be/NLqAF9hrVbY
https://youtube.com/shorts/xbGCdZ2Ei7g
http://www.youtube.com/embed/NLqAF9hrVbY
https://www.youtube.com/embed/NLqAF9hrVbY
http://www.youtube.com/v/NLqAF9hrVbY?fs=1&hl=en_US
http://www.youtube.com/watch?v=NLqAF9hrVbY
http://www.youtube.com/ytscreeningroom?v=NRHVzbJVx8I
http://www.youtube.com/watch?v=JYArUl0TzhA&feature=featured
```

\> ⚠️ **Does not support:** live videos, user profile links, playlists.

## **Rate Limiting**

## **Limits**

Each subscription plan of the API defines the maximum number of requests permitted per month or the quota, in addition to a rate limit expressed in RPS (Requests Per Second).

Please note that all free plans of the API (e.g. BASIC) are rate limited to 1000 requests per hour. This is a RapidAPI requirement for any free plan.

## **Rate Limits Headers**

All API responses include rate limit information in the following headers:

-   **x-ratelimit-requests-limit:** number of requests the plan you are currently subscribed to allows you to make before incurring overages.
-   **x-ratelimit-requests-remaining:** The number of requests remaining (from your plan) before you reach the limit of requests your application is allowed to make. When this reaches zero, you will begin experiencing overage charges. This will reset each day or each month, depending on how the API pricing plan is configured. You can view these limits and quotas on the pricing page of the API in the API Hub.
-   **x-ratelimit-requests-reset:** Indicates the number of seconds until the quota resets. This number of seconds would at most be as long as either a day or a month, depending on how the plan was configured.

## **Handling Limits**

When hitting the rate limits of the API, the RapidAPI gateway will return a 429 Too Many Requests error. When that happens, wait until your rate limit resets, or consider upgrading your subscription plan for a higher limit. We can support almost any monthly quota and rate limit, contact us for more information.

Here’s an example of a 429 Too Many Requests error:

```
{
    "message":"Too many requests"
}
```

## **Code Examples**

Code examples are available for all popular programming languages and environments (Javascript, Python, Java, Shell, etc) on the Endpoints tab, on the right panel, under “Code Snippets”.

## **Common Use Cases**

Supadata YouTube Transcripts API can be used for a variety of use cases, including:

-   **Content Creation and Summarization:** Extract and summarize YouTube video transcripts to generate concise content for blogs, articles, or social media posts.
-   **SEO Optimization:** Use video transcripts to identify keywords and create SEO-friendly written content that aligns with the video's theme.
-   **Market Research:** Analyze video discussions and topics to gain insights into audience preferences, trends, and emerging ideas in specific industries or niches.
-   **Sentiment Analysis:** Perform sentiment analysis on transcripts to understand audience reactions to topics, products, or events discussed in videos.
-   **Language Learning and Accessibility:** Convert YouTube transcripts into educational materials, or create text-based resources to make video content more accessible for diverse audiences.
-   **Video Indexing and Searchability:** Build tools to enable search functionality across video libraries by indexing transcript text, making it easier to locate relevant content.
-   **Data-Driven Applications:** Integrate video transcripts into applications or workflows for generating insights, training AI models, or automating content curation tasks.
-   **Academic Research:** Use transcripts to analyze trends, study discourse on specific topics, or gather data for linguistic or cultural studies.

## **Error Handling**

The Supadata YouTube Transcript API is designed to provide robust and reliable access to YouTube data. However, in the event of errors during API interaction, we use HTTP status codes to indicate the nature of the problem. Below, you'll find detailed explanations of common error codes you may encounter, along with potential causes and suggested remediation steps.

## **Common HTTP Status Codes**

-   **400 Bad Request:** This status is returned when your request is malformed or missing some required parameters. The response body might also include a “message” field, explaining the specific error. Ensure that all required fields are included and properly formatted before retrying your request.
-   **403 Forbidden:** This error indicates that you are not subscribed to the API or that your API key is invalid. If you believe this is in error, please contact RapidAPI support - [support@rapidapi.com](mailto:support@rapidapi.com).
-   **404 Not Found:** This status is returned if the requested resource could not be found. This can occur with incorrect URL endpoints. Double-check the URL and try again.
-   **429 Too Many Requests:** This error means you have hit the rate limit for your subscription plan. Wait until your rate limit resets, or consider upgrading your subscription plan for a higher limit. If you believe this is in error, please contact us.
-   **5XX Server Error (500, 502, and 503):** This indicates a problem with our servers processing your request or an internal server timeout. This is a rare occurrence and should be temporary. If this error persists, please contact our technical support for assistance.

## **Error Response Structure**

Errors returned by our API backend will have a message and potentially other details attached to them to help you understand and resolve issues. Here’s an example of an error response:

```
{
    "error": "Missing parameters"
}
```

```
{
    "error": "Something went wrong with the request"
}
```

Some errors like 429 Too Many Requests, 403 Forbidden, or 404 Not Found, might be returned from RapidAPI gateway, in that case, the structure will be different. Here’s an example of an error response:

```
{
  "message": "You are not subscribed to this API."
}
```

## **Handling Errors Programmatically**

Implement error handling in your application to manage these responses gracefully. Here are some tips:

-   **Retry Logic:** For 5XX (500, 502, 503) and 429, implement a retry mechanism that waits for a few seconds before retrying the request.
-   **Validation:** Prior to sending requests, validate parameters to catch common errors like 400 Bad Request.
-   **Logging:** Log error responses for further analysis to understand patterns or recurring issues that might require changes in how you integrate with the API.

## **Support**

If you encounter any issues that you are unable to resolve, or if you need further clarification on the errors you are seeing, please do not hesitate to contact us (see the Contact Us section below). Provide us with the error code, message, and the context in which the error occurred, and we will assist you promptly.

## **Popular Supadata APIs 👉**

-   ✅ [TikTok Transcripts](https://rapidapi.com/8v2FWW4H6AmKw89/api/tiktok-transcripts) - Fast and Reliable TikTok Transcript API.
-   ✅ [Instagram Transcripts](https://rapidapi.com/8v2FWW4H6AmKw89/api/instagram-transcripts) - Fast and Reliable Instagram Transcript API.
-   ✅ [AI Content Scraper](https://rapidapi.com/8v2FWW4H6AmKw89/api/ai-content-scraper) - Fast and Reliable Web Scraping API. This scraper can accept any website URL and turn it into Markdown format, ready for use in AI (eg. RAG, training custom AI chatbots etc).

## **Terms of Use**

### **1\. Acceptance of Terms**

By accessing or using the API services provided, you agree to be bound by these Terms of Use. If you do not agree to these terms, you may not use the API services.

### **2\. License**

The API is provided on a limited, non-exclusive, non-transferable, and revocable license for the purpose of accessing data in accordance with applicable laws and these terms. You agree not to resell, redistribute, or sub-license access to the API without explicit permission.

### **3\. Compliance with Laws**

You agree to comply with all applicable laws, regulations, and policies of the respective platforms or websites (eg. YouTube) and the jurisdiction in which you operate. You are solely responsible for ensuring your use of the API complies with the terms and policies of third-party platforms from which data is retrieved.

### **4\. Prohibited Uses**

You agree not to use the API:

-   To violate any laws or regulations.
-   To collect or process personal data without consent.
-   For any fraudulent, malicious, or harmful purposes.
-   To engage in activities that may harm the platforms from which data is retrieved (e.g., excessive requests, scraping sensitive data).

### **5\. Data Usage**

This API only collects publicly available data. No private or sensitive information is retrieved through this service. It is your responsibility to ensure that your use of the data complies with privacy regulations and platform policies. Data collected via the API should not be used for unethical or illegal purposes.

### **6\. Disclaimer of Warranties**

The API is provided "as-is" without any warranties, whether express or implied, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, or non-infringement.

### **7\. Limitation of Liability**

In no event shall the API provider be liable for any damages (including, without limitation, indirect, consequential, special, punitive, or incidental damages) arising out of or in connection with the use or inability to use the API, even if advised of the possibility of such damages.

### **8\. Termination and Service Availability**

The provider reserves the right to suspend, discontinue, or terminate access to the API at any time, for any reason, and without prior notice, including but not limited to changes in platform policies, legal obligations, or technical issues. You acknowledge that the API may become unavailable due to circumstances beyond the provider’s control, and by using the API, you assume all risks associated with potential service interruptions or discontinuation.

### **9\. Changes to Terms**

The provider may modify these Terms of Use at any time. Continued use of the API after changes constitutes acceptance of the modified terms.

## **Disclaimer**

The API provider does not own or control the data retrieved from **public internet websites or YouTube**, nor is the provider affiliated with these platforms. This is **not an official API of YouTube**, and the API only gathers **publicly available information**. No private or sensitive data is collected through this service.

Users are responsible for ensuring compliance with the respective platforms' terms of service and applicable data protection laws. The API provider is not liable for any legal or regulatory issues arising from the misuse of the data retrieved through the API. Users must ensure that any data processing or usage complies with local and international laws, including but not limited to privacy regulations (such as GDPR, CCPA).

By using this API, you acknowledge and agree that the API may be disabled, suspended, or terminated at any time due to unforeseen circumstances or other reasons. You assume all risks associated with potential service discontinuation, and the provider will not be held liable for any damages arising from the unavailability of the API.

---

API creator
supadata thumbnail
by supadata

subscribers

2651

subs

Basic
$0.00
/mo
Requests
100 / Month
Hard Limit
Rate Limit
1000 requests per hour
Bandwidth Platform Fee
10240MB / Month
+ $0.001 per 1MB
Pro
$9.00
/mo
Requests
1,000 / Month
+ $0.01
Rate Limit
-
Bandwidth Platform Fee
10240MB / Month
+ $0.001 per 1MB

---

Uwaga przy rejestracji bezpośrednio poprzez https://supadata.ai/pricing występuje inny cennik

Subscription Plans
Plan	Credits/month	Price	Rate Limit	Auto Recharge	Advanced Features	
Free	100	Free	1 / second	N/A	N/A	Sign Up
Basic	300	$5	10 / second	$10 per 1,000	N/A	Sign Up
Pro	3,000	$17	10 / second	$10 per 1,000	Yes	Sign Up
Mega	30,000	$47	50 / second	$10 per 5,000	Yes	Sign Up
Giga	300,000	$297	100 / second	$20 per 20,000	Yes	Sign Up
Supa	1,000,000	$897	100 / second	$20 per 20,000	Yes	Sign Up
Enterprise	Any	$Best	TBD	TBD	Yes	Contact Us

Each plan comes with a yearly variant at a discount (except for Basic, which is annual-only plan). Prices in USD, do not include taxes. You can upgrade/downgrade/cancel your plan at any time.
Credit usage

Fetching a website URL or getting a transcript is 1 credit. If a video does not have a transcript yet, you can choose to generate it with AI.

    1 transcript = 1 credit
    1 generated transcript minute = 2 credits
    1 video, channel or playlist = 1 credit
    1 list of channel or playlist videos = 1 credit
    1 minute of transcript translation = 30 credits
    1 URL = 1 credit
    1 site map = 1 credit

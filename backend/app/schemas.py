from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Topic = Literal["Python Data Structures", "System Design", "SQL Query Optimization"]


class QuestionOption(BaseModel):
    id: str
    text: str


class QuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    topic: Topic
    difficulty: int = Field(ge=1, le=5)
    title: str
    body: str
    options: list[QuestionOption]
    skill: str


class GenerateQuestionRequest(BaseModel):
    topic: Topic
    elo: int = Field(ge=0, le=10000)
    exclude_ids: list[str] = Field(default_factory=list, max_length=100)


class CredentialsRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr


class EvaluationRequest(BaseModel):
    question_id: str = Field(min_length=1, max_length=80)
    selected_option_id: str = Field(min_length=1, max_length=20)


class EvaluationResponse(BaseModel):
    correct: bool
    correct_option_id: str = Field(serialization_alias="correctOptionId")
    elo_delta: int = Field(serialization_alias="eloDelta")
    new_elo: int = Field(serialization_alias="newElo")
    misconception: str | None
    breakdown: str


class MasteryCategory(BaseModel):
    name: str
    score: int


class MasteryResponse(BaseModel):
    elo: int
    categories: list[MasteryCategory]
    misconceptions: list[str]
    next_steps: list[str] = Field(serialization_alias="nextSteps")
    streak: int
    total_answered: int = Field(serialization_alias="totalAnswered")
